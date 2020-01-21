const fs = require("fs");
const path = require("path");
const rimraf = require("rimraf");
const {exec} = require("child_process");

const config = JSON.parse(fs.readFileSync(path.join(__dirname, "containerizer.json")));

exports.install = async () => {

    const taskz = require("taskz");
 
    const tasks = taskz([
        {
            text: "Cleaning up old artifacs",
            task: async () => {
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
        },
        {
            text: "Creating workspace",
            task: async () => {
                fs.mkdirSync(relativeToAbsolute(config.workingDirPath));
            }
        },
        {
            text: `Cloning ${config.repository} using branch ${config.branch}`,
            task: async () => {
                const simpleGit = require("simple-git/promise")(relativeToAbsolute(config.workingDirPath));
                await simpleGit.clone(config.repository, ".", [`-b${config.branch}`]);
            }
        },
        {
            text: config.commit ? `Checking out commit ${config.commit}` : `Checking out latest commit`,
            task: async () => {
                const simpleGit = require("simple-git/promise")(relativeToAbsolute(config.workingDirPath));
                await simpleGit.checkout(config.commit ? config.commit : config.branch);
            }
        },
        { 
            text: "Running \"npm install\"",
            tasks: taskz(config.npmInstallDirs.map((dir) => {
                    return {
                        text: `in /${dir}`,
                        task: async () => {
                            await execShellCommand("npm install", {cwd: insideWorkDirPath(dir)});
                        }
                    };
                })),
        },
        {
            text: "Creating secret files",
            tasks: taskz(config.filesToCreate.map((file) => {
                    return {
                        text: `file /${file.path} with template ${file.template}`,
                        task: () => {
                            if (file.template == "typescript") {
                                fs.writeFileSync(insideWorkDirPath(file.path), `export const ${file.rootVariableName} = {${Object.keys(file.presetProperties).map((key) => `${key}: ${typeof file.presetProperties[key] != "string" && file.presetProperties[key] != "number" ? `"${typeof file.presetProperties[key] == "string" ? file.presetProperties[key].replace(/"/g, '\'') : file.presetProperties[key]}"` : file.presetProperties[key]},`).join("")}${file.properties.map((p) => `${p}: ${process.env[p]},`).join("")}};`);
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
                let buildCmd = (config.customNgBuildCmd ? config.customNgBuildCmd : `node --max-old-space-size=8192 ./node_modules/@angular/cli/bin/ng build --prod --build-optimizer=false --baseHref / --outputPath ${insideWorkDirPath(config.ngDestDir)}`);
                await execShellCommand(buildCmd, {cwd: insideWorkDirPath(config.ngSrcDir)});
            }
        },
        { 
            text: "Running additional builds",
            tasks: taskz(config.additionalBuilds.map((build) => {
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
            tasks: taskz(config.unnecessaryFilesAndDirs.map((item) => {
                    return {
                        text: `removing /${item}`,
                        task: async () => {
                            rimraf.sync(insideWorkDirPath(item));
                        }
                    };
                })),
        },
        {
            text: "Saving version data",
            task: () => {
                fs.writeFileSync(path.join(__dirname, "containerizer_client_app_version.json"), JSON.stringify({commit: config.commit, repository: config.repository, branch: config.branch}));
            },
        }
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
            console.log(error, stdout, stderr);
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