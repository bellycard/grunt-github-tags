/*
 * grunt-github-tags
 * https://github.com/ajself/grunt-github-tags
 *
 * Copyright (c) 2013 AJ Self
 * Licensed under the MIT license.
 */

'use strict';

// Dependencies
var request = require('request'),
    shell = require('shelljs');

// Helpers

/**
 * Execute shell commands
 * @param {String} single command
 * @return {Object}
 */

var exec = function (command) {
  return shell.exec(command, {silent: true});
}

module.exports = function(grunt) {

  /**
   * Easy error handler
   * @param  {String} message to display
   * @param  {String} error reported from system
   * @return {String}
   */
  var failed = function (message, error) {
    grunt.fail.warn(message || 'Sorry, task failed.');
    if (error) { grunt.verbose.error(error); }
  };

  // Set Tag task definition
  grunt.registerMultiTask('githubTags', function () {

    var options = this.options({
      rollback: false,
      // Default to version specified in project's package.json file
      tag: grunt.file.readJSON('package.json').version
    });

    if (!options.owner || !options.repo) {
      failed('You must provide the repo name and its owner\'s name');
      return;
    }

    if (!options.oauthToken) {
      failed('You must provide the oauth token');
      return;
    }

    var baseUrl = 'https://api.github.com/repos/' + options.owner + '/' + options.repo,

    githubApiReq = function (req) {
      return baseUrl + '/' + req + '/?oauth_token=' + options.oauthToken;
    },

    //sha = grunt.config('gitinfo').local.branch.current.SHA,

    sha = exec('git rev-parse --verify HEAD').output,

    tag = options.tag,

    done = this.async(),

    create_tag = function () {

      var url = githubApiReq('git/refs');

      request.post(url, {
        json: {
            sha: sha,
            ref: 'refs/tags/' + tag
          }
        }, function (err, res, body) {
          if (err) { grunt.fatal(err); done(err); }
          if (body.object.sha === sha) {
            grunt.log.ok('Tag ' + tag + ' set to ' + body.object.sha);
            done(); // Hooray!
          } else {
            failed(null, body.message);
            done(false);
          }
        }
      );
    },

    /**
     * Tries to update a tag, if it doesnt existed delegates creation process
     */
    update_tag = function () {

      url = githubApiReq('git/refs/tags');

      request.patch(url, {
          json: {
            sha: sha,
            force: true
          }
        }, function (err, res, body) {
          if (err) { failed(null, err); done(false); }

          if (body.message === 'Reference does not exist') {
            failed('Tag ' + tag + ' does not exist on upstream. Trying to create...');
            create_tag(); // Tag doesn't exist on upstream so create it
          } else if (body.object && body.object.sha === sha) {
            grunt.log.ok('Tag ' + tag + ' set to ' + sha);
            done(); // Hooray!
          } else {
            failed('Something went wrong. Perhaps changes have not been pushed to upstream.', body.message);
            done(false);
          }
        }
      );
    },

    /**
     * Creates or updates a rollback tag appended with the tag name
     */
    rollback_tag = function () {
      var url = githubApiReq('git/refs/tags' + tag)
          curr_rollback_url = githubApiReq('git/refs/tags/rollback-' + tag)
          new_rollback_url = githubApiReq('git/refs')

      // First get the current non-rollback tag SHA
      request.get(url, function (err, res, body) {
        if (err) { grunt.log.error(err); done(err); }

        if ('Not Found' === JSON.parse(body).message) {
          failed('Tag ' + tag + ' not found. Rollback tag rollback-' + tag + ' will be set to current SHA');
          update_rollback_tag(sha);
        } else {
          update_rollback_tag(JSON.parse(body).object.sha);
        }

      }),

      /**
       * Create a new rollback tag
       */
      new_rollback_tag = function (rollback_sha) {
        request.post(new_rollback_url, {
            json: {
              sha: rollback_sha,
              ref: 'refs/tags/rollback-' + tag
            }
          }, function (err, res, body) {
            if (err) { failed('Something went wrong.', err); done(false); }

            if (body.object.sha) {
              grunt.log.ok('Rollback tag rollback-' + tag + ' set to ' + rollback_sha + ' !!');
              update_tag(); // Rollback tag is set so proceed to update the requested tag
            } else {
              failed(null, body.message);
              done(false);
            }
          }
        );
      },

      /**
       * Update an existing rollback tag
       */
      update_rollback_tag = function (rollback_sha) {
        request.get(curr_rollback_url, function (err, res, body) {

          if ('Not Found' === JSON.parse(body).message) {
            failed('Tag rollback-' + tag + ' does not exist on upstream. Trying to create...');
            new_rollback_tag(rollback_sha); // Tag doesn't exist on upstream so create it

          } else {
            if (sha === rollback_sha) {

              failed('Rollback SHA is same as current. Leaving rollback alone...');
              update_tag(); // Move on!

            } else {
              request.patch(curr_rollback_url, {
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

    };

    // Kick things off
    if (options.rollback) {
      rollback_tag();
    } else {
      update_tag();
    }

  });

};
