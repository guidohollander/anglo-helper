const inquirer = require("inquirer");

module.exports = {
    perform: async function (arrSVNExternalsCurrentSolutionTag) {

        console.log('performing', arrSVNExternalsCurrentSolutionTag);

        let arrComponents=['C1','C2'];

        const questions = [
            {
                type: "list",
                name: "selectComponent",
                message: "Pick a component, any component.",
                choices: arrSVNExternalsCurrentSolutionTag
            }]
        await inquirer
            .prompt(questions)
            .then((answers) => {
                console.log(answers)
            })
            .catch((error) => {
                if (error.isTtyError) {
                    console.log("Your console environment is not supported!")
                } else {
                    console.dir(error)
                }
            })
    }
}