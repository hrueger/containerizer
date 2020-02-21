const fs = require("fs");
const path = require("path");
const rimraf = require("rimraf");
const {exec} = require("child_process");

const config = JSON.parse(fs.readFileSync(path.join(__dirname, "containerizer.json")));

exports.install = async (updating=false) => {

    const taskz = require("taskz");
 
    const tasks = taskz([
        {
            text: "Cleaning up old artifacs",
            task: async () => {
                setStatus(1, 9, "Cleaning up");
                if (!updating || !config.fastUpdateMode) {
                    await new Promise((resolve, reject) => {
                        if (fs.existsSync(relativeToAbsolute(config.workingDirPath))) {
                            rimraf(relativeToAbsolute(config.workingDirPath), (err) => {
                                if (err) {
                                    reject(err);
                                } else {
                                    resolve(err);
                                }
                            });
                        } else {
                            resolve();
                        }
                    });
                }
            }
        },
        {
            text: "Creating workspace",
            task: async () => {
                setStatus(2, 9, "Creating workspace");
                if (!updating || !config.fastUpdateMode) {
                    fs.mkdirSync(relativeToAbsolute(config.workingDirPath));
                }
            }
        },
        {
            text: `Cloning ${config.repository} using branch ${config.branch}`,
            task: async () => {
                setStatus(3, 9, "Downloading");
                const simpleGit = require("simple-git/promise")(relativeToAbsolute(config.workingDirPath));
                if (!updating || !config.fastUpdateMode) {
                    await simpleGit.clone(config.repository, ".", [`-b${config.branch}`]);
                } else {
                    await simpleGit.pull();
                }
            }
        },
        {
            text: config.commit ? `Checking out commit ${config.commit}` : `Checking out latest commit`,
            task: async () => {
                setStatus(4, 9, "Downloading");
                if (!updating || !config.fastUpdateMode) {
                    const simpleGit = require("simple-git/promise")(relativeToAbsolute(config.workingDirPath));
                    await simpleGit.checkout(config.commit ? config.commit : config.branch);
                }
            }
        },
        { 
            text: "Running \"npm install\"",
            tasks: taskz(config.npmInstallDirs.map((dir, index) => {
                    return {
                        text: `in /${dir}`,
                        task: async () => {
                            setStatus(5, 9, `Installing dependencies ${index + 1} of ${config.npmInstallDirs.length}`);
                            await execShellCommand("npm install", {cwd: insideWorkDirPath(dir)});
                        }
                    };
                })),
        },
        {
            text: "Creating secret files",
            tasks: taskz(config.filesToCreate.map((file) => {
                setStatus(6, 9, "Creating config");
                const data = {};
                Object.keys(file.presetProperties).map((key) => {
                    data[key] = file.presetProperties[key];
                });
                file.properties.map((key) => {
                    data[key] = process.env[key];
                });
                return {
                    text: `file /${file.path} with template ${file.template}`,
                    task: () => {
                        if (file.template == "typescript") {
                            fs.writeFileSync(insideWorkDirPath(file.path), `export const ${file.rootVariableName} = ${JSON.stringify(data)};`);
                        } else {
                            throw new Error(`Template ${file.template} is not supported!`);
                        }
                    }
                };
            })),
        },
        {
            text: `Building Angular app from ${config.ngSrcDir} with ${config.customNgBuildCmd ? "custom" : "standard"} build command ${config.customNgBuildCmd ? `(${config.customNgBuildCmd})` : ""}`,
            task: async () => {
                setStatus(7, 9, `Installing 1 of ${config.additionalBuilds.length + 1}`);
                let buildCmd = (config.customNgBuildCmd ? config.customNgBuildCmd : `node --max-old-space-size=8192 ./node_modules/@angular/cli/bin/ng build --prod --build-optimizer=false --baseHref ${process.env.baseHref ? process.env.baseHref : "/"} --outputPath ${insideWorkDirPath(config.ngDestDir)}`);
                await execShellCommand(buildCmd, {cwd: insideWorkDirPath(config.ngSrcDir)});
            }
        },
        { 
            text: "Running additional builds",
            tasks: taskz(config.additionalBuilds.map((build, index) => {
                    setStatus(8, 9, `Installing ${index + 2} of${config.additionalBuilds.length + 1}`);
                    return {
                        text: `building /${build.dir} with command ${build.cmd}`,
                        task: async () => {
                            await execShellCommand(build.cmd, {cwd: insideWorkDirPath(build.dir)});
                        }
                    };
                })),
        },
        {
            text: "Removing unnecessary files and directories",
            tasks: () => {
                if (!config.fastUpdateMode) {
                    return taskz(config.unnecessaryFilesAndDirs.map((item) => {
                        setStatus(9, 9, `Cleaning up`);
                        return {
                            text: `removing /${item}`,
                            task: async () => {
                                rimraf.sync(insideWorkDirPath(item));
                            }
                        };
                    }));
                }
            },
        },
    ]);
    await tasks.run().catch((err) => {
        console.log("\n");
        console.error(err);
        console.log("*******************************")
        console.log("*******************************")
        console.log("*******************************")
        console.log("*******************************")
        // process.exit(1);
    });
    console.log();
    console.log("Installation finished.");
    console.log("Saving version info...");
    console.log();
    const simpleGit = require("simple-git/promise")(relativeToAbsolute(config.workingDirPath));
    const hash = (await simpleGit.log(["HEAD"])).latest.hash;
    fs.writeFileSync(path.join(__dirname, "containerizer_client_app_version.json"), JSON.stringify({
        commit: hash,
        repository: config.repository,
        branch: config.branch,
    }));
}


// Helpers

function relativeToAbsolute(p) {
    return path.join(__dirname, p);
}

function insideWorkDirPath(p) {
    return path.join(relativeToAbsolute(config.workingDirPath), p);
}

function execShellCommand(cmd, options) {
    return new Promise((resolve, reject) => {
        const child = exec(cmd, options, (error, stdout, stderr) => {
            console.log();
            console.log();
            console.log();
            console.warn(error);
            console.warn(error);
            console.warn(stdout);
            console.warn(stdout);
            console.warn(stderr);
            console.warn(stderr);
            if (error) {
                /*console.log("\n");
                console.warn(error);
                console.log("ERROR________________________________________")
                console.log("ERROR________________________________________")
                console.log("ERROR________________________________________")
                console.log("ERROR________________________________________")*/
                // process.exit(1);
            }
            resolve(stdout? stdout : stderr);
        });
        // child.stdout.pipe(process.stdout);
        child.stdout.setEncoding('utf8');
        child.stdout.on('data', (chunk) => {
            console.log("Info:", chunk.toString("utf8"));
        });

    });
}

function setStatus(stepNr, totalSteps, statusText) {
    fs.writeFileSync(path.join(__dirname, "installStatus.json"), JSON.stringify({stepNr, totalSteps, statusText}));
}