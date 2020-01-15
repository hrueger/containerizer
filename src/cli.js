const figlet = require('figlet');
const chalk = require('chalk');
const clear = require('clear');

export async function cli(argv) {
    clear();
    console.log(chalk.cyan("Welcome to"));
    console.log(chalk.cyan(figlet.textSync('Containerizer')));
    console.log(chalk.cyan("v1.0.0"));
    console.log("\n");
    console.log(chalk.yellow("Thanks for using this tool. Feel free to contribute by creating pull requests or reporting issues on GitHub!"));
    
    // console.log(argv);
}