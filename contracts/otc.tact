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
    inputMasterToken: Address;
    outputMasterToken: Address; 
    inputWalletAddress: Address = ZERO_ADDRESS;
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
    supplyLockEnd: Int as uint64 = 0;
    totalLockEnd: Int as uint64 = 0;
    isSupply: Bool;
    buybackPrice: Int as coins;       
    state: Int as uint8 = STATE_FUNDING;
    withdrawData: FarmWithdrawData?;
    proposedAt: Int? as uint64;
    withdrawDataIsAccepted: Bool?;

    init(id: Int, inputMasterToken: Address, outputMasterToken: Address, admin: Address, client: Address, supplies: map<Int as uint8, Supply>, priceToRefund: Int as coins, outputMinAmount: Int as coins, minInputAmount: Int as coins, isSupply: Bool) {
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
        self.isSupply = isSupply;
        let outputSum = 0;
        let inputSum = 0;
        foreach (key, value in self.supplies) {
            self.supplyCount += 1;
            outputSum += value.output;
            inputSum += value.input;
        }
        require(outputSum >= outputMinAmount || !self.isSupply, "Output sum must be greater than output min amount");
        require(inputSum >= minInputAmount || self.isSupply, "Input sum must be greater than min input amount");
        require(self.supplyCount > 0 && self.isSupply || !self.isSupply && self.supplyCount == 0, "Supply count must be greater than 0 if input master token is not null or equal to zero if input master token is null");

        self.buybackPrice = priceToRefund;

        if (inputMasterToken != ZERO_ADDRESS) {
            send(SendParameters{
                to: inputMasterToken,
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
            self.state = STATE_SUPPLY_IN_PROGRESS;
            self.supplyLockEnd = now() + SUPPLY_LOCK_PERIOD;
        }
    }

    receive("check-input") {
        nativeReserve(MIN_OTC_BALANCE + self.tonBalance, 0);
        let ctx = context();
        require(self.inputMasterToken != ZERO_ADDRESS, "Input token is jetton");
        require(ctx.sender == self.client, "Only client can check input");
        
        require(ctx.value >= MIN_CHECK_AMOUNT, "Value must be greater than min check input amount");
        require(self.state == STATE_FUNDING, "State must be replenishment of funds");
        self.inputTokenBalance = 0;
        send(SendParameters{
            to: self.inputWalletAddress,
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
        require(self.state == STATE_FUNDING, "State must be replenishment of funds");
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
            self.state = STATE_SUPPLY_IN_PROGRESS;
            self.supplyLockEnd = now() + SUPPLY_LOCK_PERIOD;
        }
        nativeReserve(MIN_OTC_BALANCE + self.tonBalance, 0);

        send(SendParameters{
            to: sender(),
            value: 0,
            mode: SendRemainingBalance|SendIgnoreErrors,
            bounce: false,
        });
    }

    receive("withdraw-ton") {
        let ctx = context();
        nativeReserve(MIN_OTC_BALANCE, 0);
        require(ctx.sender == self.client, "Only client can withdraw TON");
        require(self.supplyLockEnd < now(), "Supply lock is active");
        require(self.tonBalance > 0, "No TON balance to withdraw");

        self.tonBalance = 0;
        
        send(SendParameters{
            to: self.client,
            value: 0,
            mode: SendRemainingBalance,
            bounce: false,
        });
    }

    receive(msg: WithdrawInput) {
        let ctx: Context = context();
        require(ctx.sender == self.client, "Only client can withdraw TON");
        require(self.supplyLockEnd < now(), "Supply lock is active");

        nativeReserve(MIN_OTC_BALANCE + self.tonBalance, 0);
        
        send(SendParameters{
            to: self.inputWalletAddress,
            value: 0,
            mode: SendRemainingBalance,
            bounce: false,
            body: TokenTransfer {
                query_id: msg.queryId,
                amount:  msg.amount,
                recipient: self.client,
                forward_ton_amount: 0,
                forward_payload: emptySlice(),
            }.toCell(),
        });
    }

    receive(msg: WithdrawOutput) {
        let ctx: Context = context();
        require(ctx.sender == self.client, "Only client can withdraw TON");
        require(self.totalLockEnd < now(), "Total lock is active");
        require(self.supplyLockEnd < now(), "Supply lock is active");
        self.state = STATE_CANCELED;

        self.tonBalance = 0;
        nativeReserve(MIN_OTC_BALANCE + self.tonBalance, 0);
        
        send(SendParameters{
            to: self.outputWalletAddress,
            value: 0,
            mode: SendRemainingBalance,
            bounce: false,
            body: TokenTransfer {
                query_id: msg.queryId,
                amount:  msg.amount,
                recipient: self.client,
                forward_ton_amount: 0,
                forward_payload: emptySlice(),
            }.toCell(),
        });
    }



    receive(msg: TokenNotification) {
        let ctx = context();
      
        if (ctx.sender == self.inputWalletAddress) {
            if (msg.from == myAddress()) { 
                let opcode: Int = msg.forward_payload.loadUint(32);
                if(opcode == CHECK_INPUT_MESSAGE_ID) {
                    self.state = STATE_SUPPLY_IN_PROGRESS;
                    self.inputTokenBalance += msg.amount;
                    self.supplyLockEnd = now() + SUPPLY_LOCK_PERIOD;
                } else {
                    self.inputTokenBalance += msg.amount;
                }
            } else if (msg.from == self.admin) {
                require(self.proposedAt!! + PROPOSE_FARM_ACCOUNT_LOCK_PERIOD < now() && self.withdrawDataIsAccepted == null || self.withdrawDataIsAccepted != null && self.withdrawDataIsAccepted == false, "Propose farm account lock is active");
                let outputAmount = msg.amount * NOMINATOR / self.buybackPrice;
                self.state = STATE_CANCELED;
                require(outputAmount <= self.outputTokenBalance, "Not enough output token for buyback");
                self.outputTokenBalance -= outputAmount;
                send(SendParameters{
                    to: self.outputWalletAddress,
                    value: FORWARD_TRANSACTION_VALUE,
                    mode: SendIgnoreErrors,
                    bounce: false,
                    body: TokenTransfer {
                        query_id: msg.query_id,
                        amount: outputAmount,
                        recipient: self.admin,
                        forward_ton_amount: 0,
                        forward_payload: emptySlice(),
                    }.toCell(),
                });
            }
        } else if (ctx.sender == self.outputWalletAddress) {
            if (msg.from == myAddress()) { 
                let opcode: Int = msg.forward_payload.loadUint(32);
                if(opcode == CHECK_OUTPUT_MESSAGE_ID) {
                    self.state = STATE_SUPPLY_PROVIDED;
                    self.outputTokenBalance += msg.amount;
                    self.totalLockEnd = now() + TOTAL_LOCK_PERIOD;
                } else {
                    self.outputTokenBalance += msg.amount;
                }
            } else  if (msg.from == self.admin) {
                self.handleSupplyProcess(msg);
            }
            
        }
    }

    receive(msg: ProposeFarmAccount) {
        require(sender() == self.admin, "Only admin");
        require(self.state == STATE_SUPPLY_PROVIDED, "State must be supply provided");
        nativeReserve(MIN_OTC_BALANCE + self.tonBalance, 0);
        self.withdrawData = msg.withdrawData;
        self.proposedAt = now();
        self.state = STATE_WAITTING_FOR_CLIENT_ANSWER;

        send(SendParameters{
            to: self.admin,
            value: 0,
            mode: SendRemainingBalance|SendIgnoreErrors,
            bounce: false,
        });
    }

    receive("yes") {
        let ctx = context();
        require(ctx.sender == self.client, "Only client can call");
        require(self.state == STATE_WAITTING_FOR_CLIENT_ANSWER || self.state == STATE_CLIENT_ACCEPTED || self.state == STATE_CLIENT_REJECTED, "State must allow client voting");
        self.withdrawDataIsAccepted = true;
        self.state = STATE_CLIENT_ACCEPTED;
    }

    receive("no") {
        let ctx = context();
        require(ctx.sender == self.client, "Only client can call");
        require(self.state == STATE_WAITTING_FOR_CLIENT_ANSWER || self.state == STATE_CLIENT_ACCEPTED || self.state == STATE_CLIENT_REJECTED, "State must allow client voting");
        self.withdrawDataIsAccepted = false;
        self.state = STATE_CLIENT_REJECTED;
    }

    receive(msg: Send) {
        require(sender() == self.admin, "Only admin");
        nativeReserve(MIN_OTC_BALANCE + self.tonBalance, 0);
        require(self.state == STATE_CLIENT_ACCEPTED, "Client must have accepted the proposal");
        require(self.withdrawDataIsAccepted!!== true, "Withdraw is not accepted");

        send(SendParameters{
            to: self.outputWalletAddress,
            value: 0,
            mode: SendRemainingBalance|SendIgnoreErrors,
            bounce: false,
            body: TokenTransfer {
                query_id: msg.queryId,
                amount: self.outputMinAmount,
                recipient: self.withdrawData!!.farmAccount,
                forward_ton_amount: msg.forwardTonAmount,
                forward_payload:  self.withdrawData!!.sendData.asSlice(),
            }.toCell(),
        });
    }

    receive(msg: BuybackLaunchJetton) {
        let ctx = context();
        require(ctx.sender == self.admin, "Only admin can buyback");
        require(self.inputMasterToken == ZERO_ADDRESS, "Buyback only for TON inputs");

        require(self.proposedAt!! + PROPOSE_FARM_ACCOUNT_LOCK_PERIOD < now() && self.withdrawDataIsAccepted==null || self.withdrawDataIsAccepted!=null && self.withdrawDataIsAccepted == false, "Propose farm account lock is active");


        let outputAmount = ctx.value * NOMINATOR / self.buybackPrice;
        require(outputAmount <= self.outputTokenBalance, "Not enough POK for buyback");
        self.state = STATE_CANCELED;
        self.outputTokenBalance -= outputAmount;
        send(SendParameters{
            to: self.inputWalletAddress,
            value: FORWARD_TRANSACTION_VALUE,
            mode: SendIgnoreErrors,
            bounce: false,
            body: TokenTransfer {
                query_id: msg.queryId,
                amount: outputAmount,
                recipient: myAddress(),
                forward_ton_amount: 0,
                forward_payload: emptySlice(),
            }.toCell(),
        });

    }
    //*warning: this function is for testing only ----------------------------------------------------------------------------------------------------------
    receive("unlock-for-test") {
        require(sender() == self.admin, "Only admin can unlock for test");
        self.totalLockEnd = 0;
        self.supplyLockEnd = 0;
        self.proposedAt = 0;
    }

    inline fun handleSupplyProcess(msg: TokenNotification) {
        let currentSupply: Supply = self.supplies.get(self.indexSupply)!!;
        require(currentSupply.output  <= msg.amount, "Amount must be greater than supply output");
        require(self.state == STATE_SUPPLY_IN_PROGRESS, "State must be supply of funds");

        self.indexSupply += 1;
        if (self.indexSupply == self.supplyCount) {
            self.state = STATE_SUPPLY_PROVIDED;
            self.totalLockEnd = now() + TOTAL_LOCK_PERIOD;
        }

        if (self.inputMasterToken == ZERO_ADDRESS) {
            self.tonBalance -= currentSupply.input;
            nativeReserve(MIN_OTC_BALANCE + self.tonBalance, 0);
            send(SendParameters{
                to: self.admin,
                value: 0,
                mode: SendRemainingBalance,
                bounce: false,
            });
        } else {
            self.inputTokenBalance -= currentSupply.input;
            nativeReserve(MIN_OTC_BALANCE + self.tonBalance, 0);
            send(SendParameters{
                to: self.inputWalletAddress,
                value: 0,
                mode: SendRemainingBalance,
                bounce: false,
                body: TokenTransfer {
                    query_id: self.id,
                    amount: currentSupply.input,
                    recipient: self.admin,
                    forward_ton_amount: 0,
                    forward_payload: emptySlice(),
                }.toCell(),
            });
        }
    }
    get fun outputTokenMaster(): Address {
        return self.outputMasterToken;
    }

    // Getter for input master token
    get fun inputTokenMaster(): Address {
        return self.inputMasterToken;
    }

    // Getter for input wallet address
    get fun inputWallet(): Address {
        return self.inputWalletAddress;
    }

    // Getter for output wallet address
    get fun outputWallet(): Address {
        return self.outputWalletAddress;
    }

    // Getter for admin address
    get fun adminAddress(): Address {
        return self.admin;
    }

    // Getter for client address
    get fun clientAddress(): Address {
        return self.client;
    }

    // Getter for TON balance
    get fun tonBalanceAmount(): Int {
        return self.tonBalance;
    }

    // Getter for input token balance
    get fun inputTokenBalanceAmount(): Int {
        return self.inputTokenBalance;
    }

    // Getter for output token balance
    get fun outputTokenBalanceAmount(): Int {
        return self.outputTokenBalance;
    }

    // Getter for supply count
    get fun supplyCountValue(): Int {
        return self.supplyCount;
    }

    // Getter for current supply index
    get fun currentSupplyIndex(): Int {
        return self.indexSupply;
    }

    // Getter for price to refund
    get fun refundPrice(): Int {
        return self.priceToRefund;
    }

    // Getter for minimum input amount
    get fun minInputAmountValue(): Int {
        return self.minInputAmount;
    }

    // Getter for minimum output amount
    get fun minOutputAmount(): Int {
        return self.outputMinAmount;
    }

    // Getter for supply lock end time
    get fun supplyLockEndTime(): Int {
        return self.supplyLockEnd;
    }

    // Getter for total lock end time
    get fun totalLockEndTime(): Int {
        return self.totalLockEnd;
    }

    // Getter for buyback price
    get fun buybackPriceValue(): Int {
        return self.buybackPrice;
    }

    // Getter for current state
    get fun currentState(): Int {
        return self.state;
    }

    // Getter for withdraw data
    get fun withdrawDataInfo(): FarmWithdrawData? {
        return self.withdrawData;
    }

    // Getter for proposed time
    get fun proposedTime(): Int? {
        return self.proposedAt;
    }

    // Getter for withdraw acceptance status
    get fun withdrawAccepted(): Bool? {
        return self.withdrawDataIsAccepted;
    }

    // Getter for contract ID
    get fun contractId(): Int {
        return self.id;
    }

    // Getter for contract balance
    get fun balance(): Int {
        return myBalance();
    }
}
