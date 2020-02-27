const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const {install} = require("./install");
const http = require("http");
const GitHub = require("github-api");
const parseGitHubUrl = require("github-url-to-object");


const config = JSON.parse(fs.readFileSync(path.join(__dirname, "containerizer.json")));
const versionInfoFileName = "containerizer_client_app_version.json";
main();

async function main() {
    if (!fs.existsSync(path.join(__dirname, versionInfoFileName))) {
        console.log();
        console.log(chalk.green("First run detected, installing..."));
        console.log();
        fs.writeFileSync(path.join(__dirname, "installStatus.json"), JSON.stringify({stepNr: 0, totalSteps: 10, statusText: "Loading"}));
        const server = createStatusServer();
        console.log(chalk.yellow("Status server started on port 80"));
        await install();
        fs.writeFileSync(path.join(__dirname, "environment_cache"), JSON.stringify(process.env));
        await new Promise((resolve, reject) => {
            server.close((err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
        console.log(chalk.yellow("Status server stopped in order to free port 80 for client app"));
        startApp();
    } else if (detectEnvChange()) {
        console.log();
        console.log(chalk.green("Environment change detected, rebuilding..."));
        console.log();
        await install();
        fs.writeFileSync(path.join(__dirname, "environment_cache"), JSON.stringify(process.env));
        startApp();
    } else {
        console.log();
        console.log(chalk.green("No environment change detected, starting client app..."));
        console.log();
        startApp();
    }
}

function startApp() {
    const config = JSON.parse(fs.readFileSync(path.join(__dirname, "containerizer.json")));
    const clientAppProcess = spawn("node", [insideWorkDirPath(config.startFile, config)]);
    clientAppProcess.stdout.on("data", data => {
        console.log(chalk.cyan("Client app: ") + data);
    });
    clientAppProcess.stderr.on("data", data => {
        console.log(chalk.red("Client app: ") + data);
    });
    clientAppProcess.on('error', (error) => {
        console.log(chalk.red("Client app: ") + data);
    });
    clientAppProcess.on("close", code => {
        console.log(chalk.yellow(`Client app exited with code ${code}.`));
    });
    const server = http.createServer(async function (request, response) {
        response.writeHead(200, { "Content-Type": "application/json" });
        if (request.url.endsWith("/update")) {
            response.end(JSON.stringify({success: true}), "utf-8");
            server.close();
            await update(clientAppProcess);
        } else {
            const gh = new GitHub();
            const repoInfo = parseGitHubUrl(config.repository);
            if (!fs.existsSync(path.join(__dirname, versionInfoFileName))) {
                response.end(JSON.stringify({updatesAvalible: false}), "utf-8");
                return;
            }
            const versionInfo = JSON.parse(fs.readFileSync(path.join(__dirname, versionInfoFileName)));
            const commits = (await (await gh.getRepo(repoInfo.user, repoInfo.repo)).listCommits()).data.reverse();
            const newerCommits = [];
            let commit;
            do {
                if (commit) {
                    newerCommits.push(commit);
                }
                commit = commits.pop();
            } while (commit && commit.sha != versionInfo.commit)
            const data = {};
            if (newerCommits.length > 0) {
                data.updatesAvalible = true;
                data.updateCount = newerCommits.length;
                data.updates = newerCommits.map((c) => c.commit.message);
            } else {
                data.updatesAvalible = false;
            }
            data.containerizerVersion = require("./package.json").version;
            data.time = Date.now();
            response.end(JSON.stringify({data}, getCircularReplacer()), "utf-8");
        }
    }).listen(8314);
}

async function update(clientAppProcess) {
    console.log();
    console.log(chalk.yellow("Stopping client app in order to update..."));
    console.log();
    clientAppProcess.stdin.pause();
    clientAppProcess.kill();
    await new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve();
        }, 10000);
    });
    console.log(chalk.yellow("Starting update"));
    console.log();
    const server = createStatusServer(true);
    console.log(chalk.yellow("Status server started on port 80"))
    await install(true);
    console.log();
    await new Promise((resolve, reject) => {
        server.close((err) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
    console.log(chalk.yellow("Status server stopped in order to free port 80 for client app"));
    console.log(chalk.green("Updating finished, starting client app..."));
    console.log();
    startApp();
}

function insideWorkDirPath(p, config) {
    return path.join(relativeToAbsolute(config.workingDirPath), p);
}

function relativeToAbsolute(p) {
    return path.join(__dirname, p);
}

function detectEnvChange() {
    const config = JSON.parse(fs.readFileSync(path.join(__dirname, "containerizer.json")));
    const envFromCache = JSON.parse(fs.readFileSync(path.join(__dirname, "environment_cache")));
    const envCurrent = process.env;
    const isSimilar = true;
    removeDuplicates(config.filesToCreate.map((file) => file.properties).flat()).forEach((prop) => {
        if (envFromCache[prop] != envCurrent[prop]) {
            console.log(prop, "EnvFromCache:", envFromCache[prop], "current", envCurrent[prop]);
            isSimilar = false;
        }
    });
    return !isSimilar;
}

function removeDuplicates(array) {
    return array.filter((a, b) => array.indexOf(a) === b) ;
};

const getCircularReplacer = () => {
    const seen = new WeakSet();
    return (key, value) => {
      if (typeof value === "object" && value !== null) {
        if (seen.has(value)) {
          return;
        }
        seen.add(value);
      }
      return value;
    };
};

function createStatusServer(updating=false) {
    return http.createServer(function (request, response) {
        response.writeHead(200, { "Content-Type": "text/html" });
        const data = JSON.parse(fs.readFileSync(path.join(__dirname, "installStatus.json")).toString());
        const percentage = Math.ceil(data.stepNr / data.totalSteps * 100);
        response.end(`
<!DOCTYPE html>
<html>
<head>
<meta http-equiv="refresh" content="2"/>
<link href="https://stackpath.bootstrapcdn.com/bootstrap/4.4.1/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-Vkoo8x4CGsO3+Hhxv8T/Q5PaXtkKtu6ug5TOeNV6gBiFeWPGFN9MuhOf23Q9Ifjh" crossorigin="anonymous">
<title>${percentage}% | ${updating ? "Updating" : "Installing"} ${config.imageName}</title>
</head>
<body>
<div class="container p-1 pt-5">
<h1>${config.imageName} is ${updating ? "updating" : "installing"}...</h1>
<h5>Status: ${data.statusText}</h5>
<div class="progress">
    <div class="progress-bar progress-bar-striped active" role="progressbar" aria-valuenow="${percentage}" aria-valuemin="0" aria-valuemax="100" style="width:${percentage}%">
        ${percentage}%
    </div>
</div>
<p class="mt-3">Powered by <a href="https://github.com/hrueger/containerizer">Containerizer</a>.</p>
</div>
</body>
</html>
`, "utf-8");
    }).listen(80);
}