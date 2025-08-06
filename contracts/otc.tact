// Since v1.6.0, Tact has a contract parameters syntax that can supersede
// lazy initialization by init() for all contracts that do not require specific on-chain
// deployment logic that must be run only once in the `init()` function.
//
// Note that the empty parameter list above is still a parameter list,
// meaning that the contract won't have an implicit or explicit `init(){:tact}` function
// and will enjoy storage write optimizations and use less gas overall.
//
// See: https://docs.tact-lang.org/book/contracts/#parameters

import "./imports/constants";
import "./jetton/jetton_messages";
import "./otc_messages";

contract OTC {
    id: Int as uint32;
    inputMasterToken: Address?;
    outputMasterToken: Address;
    inputWalletAddress: Address?;
    outputWalletAddress: Address = ZERO_ADDRESS;
    admin: Address;
    client: Address;
    tonBalance: Int as coins = 0;
    inputTokenBalance: Int as coins = 0;
    outputTokenBalance: Int as coins = 0;
    supplies: map<Int as uint8, Supply>;
    supplyCount: Int as uint8 = 0;
    indexSupply: Int as uint8 = 0;
    priceToRefund: Int as coins = 0;
    minInputAmount: Int as coins = 0;
    outputMinAmount: Int as coins = 0;
    state: Int as uint8 = STATE_REPLISHMENT_OF_FUNDS;

    init(id: Int, inputMasterToken: Address?, outputMasterToken: Address, admin: Address, client: Address, supplies: map<Int as uint8, Supply>, priceToRefund: Int as coins, outputMinAmount: Int as coins, minInputAmount: Int as coins) {
        require(admin == sender(), "Only admin can initialize the contract");
        self.id = id;
        self.inputMasterToken = inputMasterToken;
        self.outputMasterToken = outputMasterToken;
        self.admin = admin;
        self.client = client;
        self.supplies = supplies;
        self.priceToRefund = priceToRefund;
        self.outputMinAmount = outputMinAmount;
        self.minInputAmount = minInputAmount;
        let outputSum = 0;
        let inputSum = 0;
        foreach (key, value in self.supplies) {
            self.supplyCount += 1;
            outputSum += value.output;
            inputSum += value.input;
        }
        require(outputSum >= outputMinAmount, "Output sum must be greater than output min amount");
        require(inputSum >= minInputAmount, "Input sum must be greater than min input amount");
        require(self.supplyCount > 0 && inputMasterToken != null || inputMasterToken == null && self.supplyCount == 0, "Supply count must be greater than 0 if input master token is not null or equal to zero if input master token is null");

        if (inputMasterToken != null && inputMasterToken != ZERO_ADDRESS) {
            send(SendParameters{
                to: inputMasterToken!!,
                value: TAKE_WALLET_ADDRESS_AMOUNT,
                mode: 0,
                bounce: false,
                body: ProvideWalletAddress{
                    query_id: id,
                    owner_address: myAddress(),
                    include_address: false,
                }.toCell(),
            });
        }


        send(SendParameters{
            to: outputMasterToken,
            value: TAKE_WALLET_ADDRESS_AMOUNT,
            mode: 0,
            bounce: false,
            body: ProvideWalletAddress{
                query_id: id,
                owner_address: myAddress(),
                include_address: false,
            }.toCell(),
        });
    }

   receive(msg: TakeWalletAddress) {
        let context = context();
        require(context.sender == self.inputMasterToken || context.sender == self.outputMasterToken, "Only input master token or output master token can take wallet address");
        nativeReserve(MIN_OTC_BALANCE + self.tonBalance, 0);
        if (context.sender == self.inputMasterToken) {
            self.inputWalletAddress = msg.wallet_address;
        } else {
            self.outputWalletAddress = msg.wallet_address;
        }
        send(SendParameters{
            to: self.admin,
            value: 0,
            mode: SendRemainingBalance|SendIgnoreErrors,
            bounce: false,
        });
    }



    receive() {
        nativeReserve(MIN_OTC_BALANCE + self.tonBalance, 0);
        send(SendParameters{
            to: self.admin,
            value: 0,
            mode: SendRemainingBalance|SendIgnoreErrors,
            bounce: false,
        });
    }

    receive("deposit-ton") {
        require(self.inputMasterToken==ZERO_ADDRESS, "Input token is jetton");
        let ctx = context();
        self.tonBalance += ctx.value - DEPOSIT_FEE;
        if (self.tonBalance >= self.minInputAmount) {
            self.state = STATE_SUPPLY_OF_FUNDS;
        }
    }

    receive("check-input") {
        nativeReserve(MIN_OTC_BALANCE + self.tonBalance, 0);
        let ctx = context();
        require(self.inputMasterToken!=ZERO_ADDRESS, "Input token is jetton");
        require(ctx.sender == self.client, "Only client can check input");
        
        require(ctx.value >= MIN_CHECK_AMOUNT, "Value must be greater than min check input amount");
        require(self.state == STATE_REPLISHMENT_OF_FUNDS, "State must be replenishment of funds");
        self.inputTokenBalance = 0;
        send(SendParameters{
            to: self.inputWalletAddress!!,
            value: 0,
            mode: SendRemainingBalance,
            bounce: false,
            body: TokenTransfer {
                query_id: self.id,
                amount: self.minInputAmount,
                recipient: myAddress(),
                forward_ton_amount: FORWARD_TRANSACTION_VALUE,
                forward_payload: CheckInput{}.toSlice(),
            }.toCell(),
        });
    }

    
    receive("check-output") {
        nativeReserve(MIN_OTC_BALANCE + self.tonBalance, 0);
        let ctx = context();
        require(ctx.sender == self.client, "Only client can check input");
        
        require(ctx.value >= MIN_CHECK_AMOUNT, "Value must be greater than min check input amount");
        require(self.state == STATE_REPLISHMENT_OF_FUNDS, "State must be replenishment of funds");
        self.outputTokenBalance = 0;
        send(SendParameters{
            to: self.outputWalletAddress,
            value: 0,
            mode: SendRemainingBalance,
            bounce: false,
            body: TokenTransfer {
                query_id: self.id,
                amount: self.outputMinAmount,
                recipient: myAddress(),
                forward_ton_amount: FORWARD_TRANSACTION_VALUE,
                forward_payload: CheckOutput{}.toSlice(),
            }.toCell(),
        });
    }

    receive(msg: DepositTon) {
        let ctx = context();
        require(self.inputMasterToken==ZERO_ADDRESS, "Input token is jetton");
        self.tonBalance += msg.amount;
        if (self.tonBalance >= self.minInputAmount) {
            self.state = STATE_SUPPLY_OF_FUNDS;
        }
        nativeReserve(MIN_OTC_BALANCE + self.tonBalance, 0);

        send(SendParameters{
            to: sender(),
            value: 0,
            mode: SendRemainingBalance|SendIgnoreErrors,
            bounce: false,
        });
    }

    receive(msg: TokenNotification) {
        let ctx = context();
        if (ctx.sender == self.inputWalletAddress!!) {
            if (msg.from == myAddress()) { 
                let opcode: Int = msg.forward_payload.loadUint(32);
                if(opcode == CHECK_INPUT_MESSAGE_ID) {
                    self.state = STATE_SUPPLY_OF_FUNDS;
                    self.inputTokenBalance += msg.amount;
                } else {
                    self.inputTokenBalance += msg.amount;
                }
            }
        } else if (ctx.sender == self.outputWalletAddress) {
            if (msg.from == myAddress()) { 
                let opcode: Int = msg.forward_payload.loadUint(32);
                if(opcode == CHECK_OUTPUT_MESSAGE_ID) {
                    self.state = STATE_WAITTING_FOR_CLIENT_ANSWER;
                    self.outputTokenBalance += msg.amount;
                } else {
                    self.outputTokenBalance += msg.amount;
                }
            } else  if (msg.from == self.admin) {
                self.handleSupplyProcess(msg);
            }
            
        }
    }

    fun handleSupplyProcess(msg: TokenNotification) {
        let curentSupply = self.supplies.get(self.indexSupply)!!;
        require(curentSupply.output  <= msg.amount, "Amount must be greater than supply output");
        require(self.state == STATE_SUPPLY_OF_FUNDS, "State must be supply of funds");
        self.indexSupply += 1;
        if (self.indexSupply == self.supplyCount) {
            self.state = STATE_WAITTING_FOR_CLIENT_ANSWER;
        }

        if (self.inputMasterToken == ZERO_ADDRESS) {
            self.tonBalance -= curentSupply.input;
            nativeReserve(MIN_OTC_BALANCE + self.tonBalance, 0);
            send(SendParameters{
                to: self.admin,
                value: 0,
                mode: SendRemainingBalance,
                bounce: false,
            });
        } else {
            self.inputTokenBalance -= curentSupply.input;
            nativeReserve(MIN_OTC_BALANCE + self.tonBalance, 0);
            send(SendParameters{
                to: self.inputWalletAddress!!,
                value: 0,
                mode: SendRemainingBalance,
                bounce: false,
                body: TokenTransfer {
                    query_id: self.id,
                    amount: curentSupply.input,
                    recipient: self.admin,
                    forward_ton_amount: 0,
                    forward_payload: emptySlice(),
                }.toCell(),
            });
        }


        
    }

}
