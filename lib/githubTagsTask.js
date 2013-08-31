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

// Execute shell commands
var exec = function (command) {
  return shell.exec(command, {silent: true});
};

// GithubTags constructor
function GithubTags (task) {
  this.origTask = task;
  this.options = task.options(GithubTags.DEFAULTS);
  this.done = task.async();
  // Current SHA on local git
  this.sha = exec('git rev-parse --verify HEAD').output;
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

// Register GithubTags multiTask with Grunt
GithubTags.registerWithGrunt = function (gruntInst) {
  gruntInst.registerMultiTask(GithubTags.name, GithubTags.description, function () {
    var task = new GithubTags(this);
    task.run();
  });

};

// Easy failure handler
GithubTags.failed = function (message, error) {
  grunt.warn(message || 'Sorry, task failed.');
  if (error) { grunt.verbose.error(error); }
};

// Easy warning handler
GithubTags.warning = function (message) {
  grunt.log.warn(message);
};

// Check that options are properly provided
GithubTags.prototype.requireOptions = function () {
  if (! _.has(this.options, 'owner')) {
    GithubTags.failed('You must provide the owner\'s name.');
  } else if (! _.has(this.options, 'repo')) {
    GithubTags.failed('You must provide the repo name.');
  } else if (! _.has(this.options, 'oauthToken')) {
    GithubTags.failed('You must provide the oauth token.')
  }
};

// Generate Github API string with params from options
GithubTags.prototype.githubApiReq = function (req) {
  var baseUrl = 'https://api.github.com/repos/' + this.options.owner + '/' + this.options.repo;
  return baseUrl + '/' + req + '/?oauth_token=' + this.options.oauthToken;
};

// Create a new tag on Github
GithubTags.prototype.createTag = function () {
  var url = this.githubApiReq('git/refs');
  var done = this.done;
  var sha = this.sha;
  var tag = this.tag;

  request.post(url, {
    json: {
        sha: this.sha,
        ref: 'refs/tags/' + this.tag
      }
    }, function (err, res, body) {
      if (err) { grunt.fatal(err); done(err); }

      if (body.object && body.object.sha === sha) {
        grunt.log.ok('Tag ' + tag + ' set to ' + body.object.sha);
        done(); // Hooray!
      } else {
        GithubTags.failed(null, body.message);
        done();
      }
    }
  );
};

// Tries to update a tag on Github
GithubTags.prototype.updateTag = function () {
  var url = this.githubApiReq('git/refs/tags');
  var done = this.done;
  var sha = this.sha;
  var tag = this.tag;
  var create_tag = this.createTag;

  request.patch(url, {
      json: {
        sha: sha,
        force: true
      }
    }, function (err, res, body) {
      if (err) { failed(null, err); done(); }

      if (body.message === 'Reference does not exist') {
        GithubTags.warning('Tag ' + tag + ' does not exist on upstream. Trying to create...');
        create_tag(); // Tag doesn't exist on upstream so create it
      } else if (body.object && body.object.sha === sha) {
        grunt.log.ok('Tag ' + tag + ' set to ' + sha);
        done(); // Hooray!
      } else {
        GithubTags.failed('Something went wrong. Perhaps changes have not been pushed to upstream.', body.message);
        done();
      }
    }
  );
};

// Check if the tag that will have a rollback set is already defined
GithubTags.prototype.checkRollbackTag = function () {
  var url = this.githubApiReq('git/refs/tags/' + this.options.tag);
  var tag = this.tag;
  var sha = this.sha;
  var update_rollback_tag = this.updateRollbackTag;

  request.get(url, function (err, res, body) {
    if (err) { GithubTags.failed(null, err); done(); }

    if ('Not Found' === JSON.parse(body).message) {
      GithubTags.warning('Tag ' + tag + ' not found. Rollback tag rollback-' + tag + ' will be set to current SHA');
      update_rollback_tag(sha);
    } else {
      update_rollback_tag(JSON.parse(body).object.sha);
    }

  });
};

// Update a rollback tag - creates a new one if it doesnt exist
GithubTags.prototype.updateRollbackTag = function (rollback_sha) {
  var tag = this.options.tag;
  var url = this.githubApiReq('git/refs/tags/rollback-' + tag);
  var update_tag = this.updateTag;
  var sha = this.sha;
  var new_rollback_tag = this.newRollbackTag;

  request.get(url, function (err, res, body) {
    if ('Not Found' === JSON.parse(body).message) {
      GithubTags.warning('Tag rollback-' + tag + ' does not exist on upstream. Trying to create...');
      new_rollback_tag(rollback_sha); // Tag doesn't exist on upstream so create it

    } else {
      if (sha === rollback_sha) {

        failed('Rollback SHA is same as current. Leaving rollback alone...');
        update_tag(); // Move on!

      } else {
        request.patch(url, {
            json: {
              sha: rollback_sha,
              force: true
            }
          }, function (err, res, body) {
            if (err) { grunt.fatal(err); done(err); }

            if (('Not Found' === body.message) || ('Reference does not exist' === body.message)) {
              failed('Tag rollback-' + tag + ' does not exist on upstream. Trying to create...');
              new_rollback_tag(rollback_sha); // Tag doesn't exist on upstream so create it
            } else {
              grunt.log.ok('Rollback tag found. Updating to current ' + tag + ' SHA: ' + body.object.sha);
              update_tag(); // Hooray! Move on!
            }
          }
        );
      }
    }
  });
};

GithubTags.prototype.newRollbackTag = function (rollback_sha) {

};

module.exports = GithubTags;
