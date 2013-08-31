/*
 * grunt-github-tags
 * https://github.com/bellycard/grunt-github-tags
 *
 * Author: AJ Self
 *
 * Copyright (c) 2013 Belly
 * Licensed under the MIT license.
 */

'use strict';

var grunt = require('grunt'),
    _ = grunt.util._,
    request = require('request'),
    shell = require('shelljs');

// Helpers
/**
 * Execute shell commands
 * @param {String} single command
 * @return {Object}
 */

var exec = function (command) {
  return shell.exec(command, {silent: true});
};

// Constructor
function GithubTags (task) {
  this.origTask = task;
  this.options = task.options(GithubTags.DEFAULTS);
  // Ensure proper options were provided
  this.requireOptions();
}

GithubTags.prototype = {
  run: function() {console.log('running');}
};

// Static information about the task
GithubTags.name = "githubTags";
GithubTags.description = "Set tags for a repo on Github.";

GithubTags.DEFAULTS = {
  // Dont set a rollback tag
  rollback: false,
  // Default to version specified in project's package.json file
  tag: grunt.file.readJSON('package.json').version
};

/**
 * Easy error handler
 * @param  {String} message to display
 * @param  {String} error reported from system
 * @return {String} grunt failure
 */

GithubTags.failed = function (message, error) {
  grunt.fail.warn(message || 'Sorry, task failed.');
  if (error) { grunt.verbose.error(error); }
};

// Check that options are properly provided
GithubTags.prototype.requireOptions = function () {
  if (! _.has(this.options, 'owner')) {
    GithubTags.failed('You must provide the owner\'s name.');
  } else if (! _.has(this.options, 'repo')) {
    GithubTags.failed('You must provide the repo name.');
  }
};

// Make the task known to Grunt
GithubTags.registerWithGrunt = function (gruntInst) {

  gruntInst.registerMultiTask(GithubTags.name, GithubTags.description, function () {
    var task = new GithubTags(this);

    task.run();
  });

};

module.exports = GithubTags;
