'use strict';

var Sequelize = require('sequelize');

/**
 * Actions summary:
 *
 * renameColumn "Files", "CreateAt", "CreatedTime"
 * renameColumn "Files", "UpdateAt", "UpdatedTime"
 *
 **/

var info = {
  "revision": 5,
  "name": "rename-createdTime-updatedTime-to-createdAt-updatedAt",
  "created": "2024-10-03T04:59:27.692Z", // Update this to the current date/time
  "comment": "Renames CreatedTime to CreatedAt and UpdateTime to UpdatedAt"
};

var migrationCommands = function(transaction) {
  return [
    {
      fn: "renameColumn",
      params: [
        "Files",
        "CreatedTime",
        "CreatedAt",
        {
          transaction: transaction
        }
      ]
    },
    {
      fn: "renameColumn",
      params: [
        "Files",
        "UpdatedTime",
        "UpdatedAt",
        {
          transaction: transaction
        }
      ]
    }
  ];
};

var rollbackCommands = function(transaction) {
  return [
    {
      fn: "renameColumn",
      params: [
        "Files",
        "CreatedAt",
        "CreatedTime",
        {
          transaction: transaction
        }
      ]
    },
    {
      fn: "renameColumn",
      params: [
        "Files",
        "UpdatedAt",
        "UpdatedTime",
        {
          transaction: transaction
        }
      ]
    }
  ];
};

module.exports = {
  pos: 0,
  useTransaction: true,
  execute: function(queryInterface, Sequelize, _commands) {
    var index = this.pos;
    function run(transaction) {
      const commands = _commands(transaction);
      return new Promise(function(resolve, reject) {
        function next() {
          if (index < commands.length) {
            let command = commands[index];
            console.log("[#"+index+"] execute: " + command.fn);
            index++;
            queryInterface[command.fn].apply(queryInterface, command.params).then(next, reject);
          } else {
            resolve();
          }
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
  up: function(queryInterface, Sequelize) {
    return this.execute(queryInterface, Sequelize, migrationCommands);
  },
  down: function(queryInterface, Sequelize) {
    return this.execute(queryInterface, Sequelize, rollbackCommands);
  },
  info: info
};
