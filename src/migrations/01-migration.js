'use strict';

var Sequelize = require('sequelize');

/**
 * Actions summary:
 *
 * createTable "Files", deps: []
 *
 **/

var info = {
    "revision": 1,
    "name": "noname",
    "created": "2020-06-23T04:54:27.692Z",
    "comment": ""
};

var migrationCommands = function(transaction) {
    return [{
        fn: "createTable",
        params: [
            "Files",
            {
                "id": {
                    "type": Sequelize.BIGINT,
                    "field": "Id",
                    "primaryKey": true,
                    "autoIncrement": true,
                    "allowNull": false
                },
                "md5": {
                    "type": Sequelize.CHAR(32),
                    "field": "Md5",
                    "unique": true,
                    "allowNull": false
                },
                "path": {
                    "type": Sequelize.CHAR(20),
                    "field": "Path",
                    "allowNull": false
                },
                "fileExt": {
                    "type": Sequelize.CHAR(4),
                    "field": "FileExt",
                    "allowNull": false
                },
                "refCount": {
                    "type": Sequelize.INTEGER,
                    "field": "RefCount",
                    "allowNull": true
                },
                "createAt": {
                    "type": Sequelize.BIGINT,
                    "field": "CreateAt",
                    "allowNull": true
                },
                "updateAt": {
                    "type": Sequelize.BIGINT,
                    "field": "UpdateAt",
                    "allowNull": true
                }
            },
            {
                "transaction": transaction
            }
        ]
    }];
};
var rollbackCommands = function(transaction) {
    return [{
        fn: "dropTable",
        params: ["Files", {
            transaction: transaction
        }]
    }];
};

module.exports = {
    pos: 0,
    useTransaction: true,
    execute: function(queryInterface, Sequelize, _commands)
    {
        var index = this.pos;
        function run(transaction) {
            const commands = _commands(transaction);
            return new Promise(function(resolve, reject) {
                function next() {
                    if (index < commands.length)
                    {
                        let command = commands[index];
                        console.log("[#"+index+"] execute: " + command.fn);
                        index++;
                        queryInterface[command.fn].apply(queryInterface, command.params).then(next, reject);
                    }
                    else
                        resolve();
                }
                next();
            });
        }
        if (this.useTransaction) {
            return queryInterface.sequelize.transaction(run);
        } else {
            return run(null);
        }
    },
    up: function(queryInterface, Sequelize)
    {
        return this.execute(queryInterface, Sequelize, migrationCommands);
    },
    down: function(queryInterface, Sequelize)
    {
        return this.execute(queryInterface, Sequelize, rollbackCommands);
    },
    info: info
};
