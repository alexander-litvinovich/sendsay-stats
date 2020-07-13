/*
  Get variations of errors in tracks by account
*/

require("isomorphic-fetch");

const dotenv = require("dotenv");
const Sendsay = require("sendsay-api");
const fs = require("fs");
const cliProgress = require("cli-progress");

const INPUT_FILE = "logins.txt";
const OUTPUT_FILE = "kinds-of-track-errors.csv";
const TRACKS_PER_PAGE = 50;

const bar = new cliProgress.SingleBar(
  {
    format: "Making queries: {value}/{total} [ {bar} — {percentage}% ]",
  },
  cliProgress.Presets.shades_classic
);

const sendsay = new Sendsay();

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

const doQuery = (login, skip = 0) => {
  const query = {
    action: "track.list",
    filter: [
      {
        a: "action",
        op: "in",
        v: [
          "issue.send",
          "stat.uni",
          "member/activate",
          "member.import",
          "member.list",
          "member.list.count",
          "member.sendconfirm",
          "member.delete",
          "stat.activity",
          "stat.group.portrait",
          "stat.group.common",
          "member.update",
          "issue.split.create",
          "sequence.member.pause",
          "issue.send/personal",
          "sequence.member.start",
          "stoplist.erase",
          "sequence.member.stop",
          "cron/run",
          "email.test",
          "stoplist.add",
          "stoplist.delete",
          "sequence.member.resume",
          "email.cleanerror",
        ],
      },
      {
        a: "status",
        op: "in",
        v: [-6, -2],
      },
    ],
    order: ["-track.dt"],
    first: TRACKS_PER_PAGE,
    skip,
  };

  return sendsay
    .request(query)
    .then((res) => res)
    .catch((err) => {
      console.log(`error with: ${login} — ${err}`);
    });
};

const processLineByLine = async () => {
  const data = fs.readFileSync(INPUT_FILE, "UTF-8");
  const logins = data.split(/\r?\n/).filter((s) => !!s);

  bar.start(logins.length, 0);

  for (const login of logins) {
    if (await loginToAccount(login)) {
      const errorsCollection = {};
      let result = await doQuery(login);
      let skip = 0;
      let nextStep = true;

      while (nextStep && !!result && !!result.list && !!result.list.length) {
        nextStep = false;

        result.list.forEach((track) => {
          errorsCollection[track.action + "%%%" + track.error] = {
            errorInfo: !!track["error.info"]
              ? JSON.stringify(track["error.info"])
              : " ",
            paramError:
              !!track.param && !!track.param.error ? track.param.error : " ",
            paramResultError:
              !!track.param &&
              !!track.param.result &&
              !!track.param.result.error
                ? track.param.result.error
                : " ",
            paramResultErrors:
              !!track.param &&
              !!track.param.result &&
              !!track.param.result.errors
                ? JSON.stringify(track.param.result.errors)
                : " ",
            id: track.id,
          };
        });

        if (!result["last_page"]) {
          nextStep = true;
          skip += TRACKS_PER_PAGE;
          result = await doQuery(login, skip);
        }
      }

      writeToFile(errorsCollection);
      bar.increment();
    }
  }
};

const writeToFile = (errorsCollection) => {
  fs.appendFileSync(
    OUTPUT_FILE,
    Object.entries(errorsCollection).reduce(
      (
        prev,
        [
          actionXError,
          {
            errorInfo,
            paramError,
            paramResultError,
            paramResultErrors,
            id,
          },
        ]
      ) =>
        (prev += `${login} ——— ${actionXError} ——— ID#${id} ——— ${errorInfo} ——— ${paramError} ——— ${paramResultError} ——— ${paramResultErrors}\n`),
      ""
    )
  );
}

dotenv.config();

processLineByLine().then((res) => {
  bar.stop();
});
