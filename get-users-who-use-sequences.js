/*
  Get accounts who use sequences
*/

require("isomorphic-fetch");

const dotenv = require("dotenv");
const Sendsay = require("sendsay-api");
const fs = require("fs");
const { Parser } = require("json2csv");
const cliProgress = require("cli-progress");

const INPUT_FILE = "logins.txt";
const OUTPUT_FILE = "users-who-use-sequences.csv";

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

const doQuery = (login) => {
  const query = {
    action: "stat.uni",
    select: ["issue.sequence.id", "sum(issue.members)"],
    filter: [
      {
        a: "issue.sequence.id",
        op: "!is_null",
      },
      {
        a: "issue.dt:YD",
        op: ">=",
        v: "current - 7 DAY",
      },
    ],
  };

  return sendsay
    .request(query)
    .then((res) => {
      return {
        login: login,
        countOfTriggers: res.list.length,
        countOfMails: res.list.reduce(
          (accum = 0, el) => accum + parseInt(el[1]),
          0
        ),
      };
    })
    .catch((err) => {
      console.log(`error with: ${login} — ${err}`);
      return {
        login,
        countOfTriggers: "error",
        countOfMails: "error",
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
