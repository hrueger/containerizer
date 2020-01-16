const fs = require("fs");
const path = require("path");
const rimraf = require("rimraf");
const {exec} = require("child_process");

const config = JSON.parse(fs.readFileSync(path.join(__dirname, "containerizer.json")));

main();

function main() {

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
                await simpleGit.checkout(config.commit);
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
                                fs.writeFileSync(insideWorkDirPath(file.path), `export const ${file.rootVariableName} = {${Object.keys(file.presetProperties).map((key) => `${key}: ${typeof file.presetProperties[key] == "string" ? `"${file.presetProperties[key].replace(/"/g, '\'')}"`: file.presetProperties[key]},`).join("")}${file.properties.map((p) => `${p}: ${process.env[p]},`).join("")}};`);
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
                let buildCmd = (config.customNgBuildCmd ? config.customNgBuildCmd : `ng build --prod --baseHref / --outputPath ${insideWorkDirPath(config.ngDestDir)}`);
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
                            await new Promise((resolve, reject) => {
                                rimraf(insideWorkDirPath(item), (err) => {
                                    if (err) {
                                        reject(err);
                                    } else {
                                        resolve(err);
                                    }
                                });
                            });
                        }
                    };
                })),
        },
        {
            text: "Starting application",
            task: async () => {
                console.log(await execShellCommand(`${relativeToAbsolute(path.join("node_modules", ".bin", "pm2"))} start ${insideWorkDirPath(config.startFile)} --name app`));
            }
        }
    ]);
    tasks.run().catch((err) => {
        console.error(err);
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
        exec(cmd, options, (error, stdout, stderr) => {
            if (error) {
                console.warn(error);
            }
            resolve(stdout? stdout : stderr);
        });
    });
}