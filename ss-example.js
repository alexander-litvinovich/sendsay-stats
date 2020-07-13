/*
  SS Example — do pongs on different accounts and write account and response duration
*/

require("isomorphic-fetch");

const dotenv = require("dotenv");
const Sendsay = require("sendsay-api");
const fs = require("fs");
const { Parser } = require("json2csv");
const cliProgress = require("cli-progress");

const INPUT_FILE = "logins.txt";
const OUTPUT_FILE = "pongs.csv";

const bar = new cliProgress.SingleBar(
  {
    format: "Making queries: {value}/{total} [ {bar} — {percentage}% ]",
  },
  cliProgress.Presets.shades_classic
);

const sendsay = new Sendsay();
const json2csvParser = new Parser();


const loginToAccount = (login) =>
  sendsay
    .login({
      login: login.trim(),
      password: process.env.MAGIC_PASS,
    })
    .then(() => true)
    .catch((err) => {
      console.log(`error with: ${login} — ${err}`);
      return false;
    });

const doQuery = async (login) => {
  /*
    Do the query for each account
  */

  const query = {
    action: "pong",
  };

  return sendsay
    .request(query)
    .then((res) => {
      /*
        Here you can get some data from response.
        Use API console to explore shapes of server response.
      */

      return {
        login: res.account,
        duration: res.duration,
      };
    })
    .catch((err) => {
      console.log(`error with: ${login} — ${err}`);
      return {
        login: res.account,
        duration: res.duration,
      };
    });
};

const processLineByLine = async () => {
  const data = fs.readFileSync(INPUT_FILE, "UTF-8");
  const logins = data.split(/\r?\n/).filter((s) => !!s);
  const result = [];

  bar.start(logins.length, 0);

  for (const login of logins) {
    if (await loginToAccount(login)) {
      result.push(await doQuery(login));
      bar.increment();
    }
  }

  return result;
};


dotenv.config();

processLineByLine().then((res) => {
  bar.stop();
  fs.writeFileSync(OUTPUT_FILE, json2csvParser.parse(res));
});
