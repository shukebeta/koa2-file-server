'use strict';

var Sequelize = require('sequelize');

/**
 * Actions summary:
 *
 * changeColumn "Files", "FileExt", "CHAR(5)"
 *
 **/

var info = {
  "revision": 4,
  "name": "update-fileExt-length-to-char-five",
  "created": "2024-10-03T04:54:27.692Z", // Update this to the current date/time
  "comment": "Updates the length of FileExt column to CHAR(5)"
};

var migrationCommands = function(transaction) {
  return [
    {
      fn: "changeColumn",
      params: [
        "Files",
        "FileExt",
        {
          type: Sequelize.CHAR(5),
          allowNull: false,
        },
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
      fn: "changeColumn",
      params: [
        "Files",
        "FileExt",
        {
          type: Sequelize.CHAR(4), // Reverting to the original length
          allowNull: false,
        },
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
