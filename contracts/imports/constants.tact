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

const STATE_FUNDING: Int = 0; // (was STATE_REPLISHMENT_OF_FUNDS)
const STATE_SUPPLY_IN_PROGRESS: Int = 1; // (was STATE_SUPPLY_OF_FUNDS)
const STATE_SUPPLY_PROVIDED: Int = 2; // supply completed, both checks passed
const STATE_WAITTING_FOR_CLIENT_ANSWER: Int = 3; // used AFTER propose
const STATE_CLIENT_ACCEPTED: Int = 4; // client answered "yes"
const STATE_CLIENT_REJECTED: Int = 5; // client answered "no"
const STATE_CANCELED: Int = 6; // final cancellation
