/* exported Options */
window.Options = {
    server: {
        "trusted" : true,
        "websocket_ip" : "test.payshares.co",
        "websocket_port" : 9001,
        "websocket_ssl" : true
    },

    mixpanel: {
        "token": '',
        // Don't track events by default
        "track": false
    },

    INFLATION_DEST: 'xURPTg7kEra2wBkP8LavDhnpGGQjCAbAnu',

    APP_ID: '1514787142083867',
    DOMAIN_NAME: 'stg.payshares.co',
    DEFAULT_FEDERATION_DOMAIN: 'stg.payshares.co',
    API_SERVER: 'https://api-stg.payshares.co',
    API_STATUS_PATH: '/status.json',
    WALLET_SERVER: 'https://wallet-stg.payshares.co',

    // If set, login will persist across sessions (page reload). This is mostly
    // intended for developers, be careful about using this in a real setting.
    PERSISTENT_SESSION : false,
    DEFAULT_IDLE_LOGOUT_TIMEOUT : 15 * 60 * 1000, //15 minutes

    REPORT_ERRORS : true,
    SENTRY_DSN : "https://4574695240794dc090caaa3f2d02fd6c@app.getsentry.com/27687",
    // Number of transactions each page has in balance tab notifications
    TRANSACTIONS_PER_PAGE: 25,

    LOGOUT_WITH_REFRESH: true,
    MAX_WALLET_ATTEMPTS: 3,

    MAX_CONTACT_AGE: 24 * 60 * 60 * 1000, // One day in milliseconds.

    CAPTCHA_KEY: '6LdSLvoSAAAAAHMyFDqGHGBDQhXdjnCwmhmV71nL',

    ANGULARTICS_WRITE_KEY: "K6D2s0Sjuu",

    DEFAULT_AJAX_TIMEOUT: 10000, // 10 seconds

    SIFT_SCIENCE_ACCOUNT: '5c25600a01'
};
