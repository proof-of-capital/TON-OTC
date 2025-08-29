const MIN_OTC_BALANCE: Int = ton("0.05");
const TAKE_WALLET_ADDRESS_AMOUNT: Int = ton("0.05");
const DEPOSIT_FEE: Int = ton("0.01");
const MIN_CHECK_AMOUNT: Int = ton("0.1");
const FORWARD_TRANSACTION_VALUE: Int = ton("0.1");


const PROPOSE_FARM_ACCOUNT_LOCK_PERIOD: Int = 10*24*60*60; // 10 DAYS
const SUPPLY_LOCK_PERIOD: Int = 10*24*60*60; // 10 days for supply phase (USDT/TON only)
const WITHDRAW_LOCK_PERIOD: Int = 10*24*60*60; // 10 days for withdraw after proposing farm address
const TOTAL_LOCK_PERIOD: Int = 120*24*60*60; // 4 months total lock
const LOCK: Int = 40*24*60*60; // 10 DAYS (deprecated, use specific constants)

const ZERO_ADDRESS: Address = address("UQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJKZ");

const NOMINATOR: Int = ton("1");

const NANO: Int = NOMINATOR;

const STATE_REPLISHMENT_OF_FUNDS: Int = 0;
const STATE_SUPPLY_OF_FUNDS: Int = 1;
const STATE_WAITTING_FOR_CLIENT_ANSWER: Int = 2;
const STATE_CANCELLED: Int = 3;
const STATE_DEPOSIT_TON: Int = 4;
