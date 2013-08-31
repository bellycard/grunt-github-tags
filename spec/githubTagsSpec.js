'use strict';

var grunt = require('grunt'),
    _ = grunt.util._,
    packageInfo = grunt.file.readJSON('package.json');

var GithubTags = require('../lib/githubTagsTask.js');

describe("githubTags task", function () {

  var makeBadMockTask = function (opts, done) {

    var taskOpts = _.extend({ bad: "option" }, opts)

    return {
      _taskOptions: taskOpts,
      filesSrc: grunt.file.expand("test/res/good*.js"),
      options: function(defs) { return _.defaults(this._taskOptions, defs); },
      async: function() {
          return done;
      }
    };
  };

  var makeGoodMockTask = function (done) {
    return {
      _taskOptions: { owner: 'TestUser', repo: 'Example' },
      filesSrc: grunt.file.expand("test/res/good*.js"),
      options: function(defs) { return _.defaults(this._taskOptions, defs); },
      async: function() {
          return done;
      }
    };
  };

  it("registers itself with Grunt", function () {
    expect(GithubTags.registerWithGrunt).toBeDefined();

    GithubTags.registerWithGrunt(grunt);

    // Make sure that Grunt is aware of the new task
    expect(grunt.task._tasks[GithubTags.name].name).toEqual(GithubTags.name);
    expect(grunt.task._tasks[GithubTags.name].info).toEqual(GithubTags.description);
  });

  it("loads options from a task", function () {
    var task = new GithubTags(makeGoodMockTask()),
        actual = task.options;

    expect(actual).toBeDefined();

    expect(actual.rollback).toBe(false);
    expect(actual.tag).toBe(packageInfo.version);
  });

  it("ensures options provide a user", function () {
    spyOn(GithubTags, 'failed');

    new GithubTags(makeBadMockTask());

    expect(GithubTags.failed).toHaveBeenCalledWith('You must provide the owner\'s name.');

  });

  it("ensures options provide a repo", function () {
    spyOn(GithubTags, 'failed');

    new GithubTags(makeBadMockTask({owner: "test"}));

    expect(GithubTags.failed).toHaveBeenCalledWith('You must provide the repo name.');
  });

});
