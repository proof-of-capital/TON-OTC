

message DepositTon {
    amount: Int as coins;
}

struct Supply {
    input: Int as coins;
    output: Int as coins;
}

const CHECK_INPUT_MESSAGE_ID: Int = 0xf96ad5e9;

message(CHECK_INPUT_MESSAGE_ID) CheckInput {}

const CHECK_OUTPUT_MESSAGE_ID: Int = 0xb904d318;

message(CHECK_OUTPUT_MESSAGE_ID) CheckOutput {}


message WithdrawInput {
    queryId: Int as uint64;
    amount: Int as coins;
}

message WithdrawOutput {
    queryId: Int as uint64;
    amount: Int as coins;
}


struct FarmWithdrawData {
    farmAccount: Address;
    sendData: Cell;
}

message ProposeFarmAccount {
    queryId: Int as uint64;
    withdrawData: FarmWithdrawData;
}


message Send {
    queryId: Int as uint64;
    forwardTonAmount: Int as coins;
}