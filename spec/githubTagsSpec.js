'use strict';

var grunt = require('grunt'),
    _ = grunt.util._,
    packageInfo = grunt.file.readJSON('package.json'),
    request = require('request'),
    shell = require('shelljs');

var GithubTags = require('../lib/githubTagsTask.js');

describe('githubTags task', function () {

  var makeBadMockTask = function (opts, done) {

    var taskOpts = _.extend({ bad: 'option' }, opts)

    return {
      _taskOptions: taskOpts,
      options: function(defs) { return _.defaults(this._taskOptions, defs); },
      async: function() {
          return done;
      }
    };
  };

  var makeGoodMockTask = function (done) {
    return {
      _taskOptions: { owner: 'TestUser', repo: 'Example', oauthToken: 'abc123' },
      options: function(defs) { return _.defaults(this._taskOptions, defs); },
      async: function() {
          return done;
      }
    };
  };

  it('registers itself with Grunt', function () {
    expect(GithubTags.registerWithGrunt).toBeDefined();

    GithubTags.registerWithGrunt(grunt);

    // Make sure that Grunt is aware of the new task
    expect(grunt.task._tasks[GithubTags.name].name).toEqual(GithubTags.name);
    expect(grunt.task._tasks[GithubTags.name].info).toEqual(GithubTags.description);
  });

  describe('load options', function () {

    it('from a task', function () {
      var task = new GithubTags(makeGoodMockTask()),
          actual = task.options;

      expect(actual).toBeDefined();

      expect(actual.rollback).toBe(false);
      expect(actual.tag).toBe(packageInfo.version);
    });

    it('ensures options provide a user', function () {
      spyOn(GithubTags, 'failed');

      new GithubTags(makeBadMockTask());

      expect(GithubTags.failed).toHaveBeenCalledWith('You must provide the owner\'s name.');

    });

    it('ensures options provide a repo', function () {
      spyOn(GithubTags, 'failed');

      new GithubTags(makeBadMockTask({owner: 'test'}));

      expect(GithubTags.failed).toHaveBeenCalledWith('You must provide the repo name.');
    });

    it('ensures options provide a oauth token', function () {
      spyOn(GithubTags, 'failed');

      new GithubTags(makeBadMockTask({owner: 'test', repo: 'example'}));

      expect(GithubTags.failed).toHaveBeenCalledWith('You must provide the oauth token.');
    });

  });

  describe('Github API URL helper', function () {

    it('generates a URL for tags with params from task options', function () {
      var task = new GithubTags(makeGoodMockTask());
      var expectedUrl = 'https://api.github.com/repos/TestUser/Example/git/refs/?oauth_token=abc123';
      var anotherExpectedUrl = 'https://api.github.com/repos/TestUser/Example/totally/not/going/to/work/but/valid/?oauth_token=abc123';

      expect(task.githubApiReq('totally/not/going/to/work/but/valid')).toEqual(anotherExpectedUrl);
    });

  });

  describe('local git information', function () {

    it('should check with the file system what the SHA is', function () {
      spyOn(shell, 'exec').andCallThrough();

      var task = new GithubTags(makeGoodMockTask());

      expect(shell.exec).toHaveBeenCalledWith('git rev-parse --verify HEAD', {silent: true})
    });

  });

  describe('creating a new tag', function (done) {

    beforeEach(function () {
      spyOn(shell, 'exec').andReturn({output: 'foobar'});
      spyOn(request, 'post');
      spyOn(grunt.log, 'ok');
      spyOn(GithubTags, 'failed')
    });

    it('should call the correct Github API URl with POST', function () {
      var task = new GithubTags(makeGoodMockTask());

      var expectedUrl = 'https://api.github.com/repos/TestUser/Example/git/refs/?oauth_token=abc123';

      task.createTag();

      expect(request.post).toHaveBeenCalled();

      expect(request.post.mostRecentCall.args[0]).toEqual(expectedUrl);

    });

    it('should output an all OK message if the tag was set properly', function (done) {
      var task = new GithubTags(makeGoodMockTask(done));

      task.createTag();

      request.post.mostRecentCall.args[2](null, null, {object: {sha: 'foobar'}});

      expect(grunt.log.ok).toHaveBeenCalled();
    });

    it('should called failed if response doesnt have a matching SHA in response', function (done) {
      var task = new GithubTags(makeGoodMockTask(done));

      task.createTag();

      request.post.mostRecentCall.args[2](null, null, {fail: 'this will fail'});

      expect(GithubTags.failed).toHaveBeenCalled();

    });

  });

  describe('updating a tag', function () {

    beforeEach(function () {
      spyOn(shell, 'exec').andReturn({output: 'foobar'});
      spyOn(request, 'patch');
      spyOn(GithubTags.prototype, 'createTag');
      spyOn(GithubTags, 'failed');
      spyOn(GithubTags, 'warning');
      spyOn(grunt.log, 'ok');
    });

    it('should call the correct Github API URL with PATCH', function () {
      var task = new GithubTags(makeGoodMockTask());

      var expectedUrl = 'https://api.github.com/repos/TestUser/Example/git/refs/tags/?oauth_token=abc123';

      task.updateTag();

      expect(request.patch).toHaveBeenCalled();

      expect(request.patch.mostRecentCall.args[0]).toEqual(expectedUrl);
    });

    it('should try to create a tag if it doesnt exist', function () {
      var task = new GithubTags(makeGoodMockTask());

      task.updateTag();

      request.patch.mostRecentCall.args[2](null, null, {message: 'Reference does not exist'});

      expect(GithubTags.warning).toHaveBeenCalled();
      expect(GithubTags.prototype.createTag).toHaveBeenCalled();
    });

    it('should fail if it cant create a tag or if update is not successfull', function (done) {
      var task = new GithubTags(makeGoodMockTask(done));

      task.updateTag();

      request.patch.mostRecentCall.args[2](null, null, {message: 'This will fail'});

      expect(GithubTags.failed).toHaveBeenCalled();
      expect(GithubTags.failed).toHaveBeenCalledWith('Something went wrong. Perhaps changes have not been pushed to upstream.', 'This will fail');
    });

    it('should log that everything is OK if successfull', function (done) {
      var task = new GithubTags(makeGoodMockTask(done));

      task.updateTag();

      request.patch.mostRecentCall.args[2](null, null, {object: {sha: 'foobar'}});

      expect(grunt.log.ok).toHaveBeenCalled();
    });

  });

  describe('rollback tags', function () {

    beforeEach(function () {
      spyOn(GithubTags, 'failed');
      spyOn(GithubTags, 'warning');
      spyOn(request, 'get');
      spyOn(request, 'patch');
      spyOn(shell, 'exec').andReturn({output: 'foobar'});
    });

    describe('getting the current, non-rollback tag SHA', function () {

      beforeEach(function () {
        spyOn(GithubTags.prototype, 'updateRollbackTag');
      });

      it('should call the correct Github API URL with GET', function () {
        var task = new GithubTags(makeGoodMockTask());

        var expectedUrl = 'https://api.github.com/repos/TestUser/Example/git/refs/tags/' + packageInfo.version + '/?oauth_token=abc123';

        task.checkRollbackTag();

        expect(request.get).toHaveBeenCalled();
        expect(request.get.mostRecentCall.args[0]).toEqual(expectedUrl);
      });

      it('should try to update the rollback tag with the current SHA if not found', function () {

        var task = new GithubTags(makeGoodMockTask());

        task.checkRollbackTag();

        request.get.mostRecentCall.args[1](null, null, JSON.stringify({message: 'Not Found'}));

        expect(GithubTags.warning).toHaveBeenCalled();

        expect(GithubTags.prototype.updateRollbackTag).toHaveBeenCalledWith('foobar');

      });

      it('should try to update the rollback tag with the returned SHA if found', function () {

        var task = new GithubTags(makeGoodMockTask());

        task.checkRollbackTag();

        request.get.mostRecentCall.args[1](null, null, JSON.stringify({object: {sha: 'baz'}}));

        expect(GithubTags.prototype.updateRollbackTag).toHaveBeenCalledWith('baz');

      });

    });

    describe('updating', function () {

      beforeEach(function () {
        spyOn(GithubTags.prototype, 'newRollbackTag');
        spyOn(GithubTags.prototype, 'updateTag');
        spyOn(grunt.log, 'ok');
      });

      it('should first get the rollback tag', function () {

        var task = new GithubTags(makeGoodMockTask());

        var expectedUrl = 'https://api.github.com/repos/TestUser/Example/git/refs/tags/rollback-' + packageInfo.version + '/?oauth_token=abc123';

        task.updateRollbackTag('qwerty');

        expect(request.get).toHaveBeenCalled();
        expect(request.get.mostRecentCall.args[0]).toEqual(expectedUrl);

      });

      it('should create a new rollback tag if one does not exist', function () {

        var task = new GithubTags(makeGoodMockTask());

        task.updateRollbackTag('qwerty');

        request.get.mostRecentCall.args[1](null, null, JSON.stringify({message: 'Not Found'}))

        expect(GithubTags.prototype.newRollbackTag).toHaveBeenCalledWith('qwerty');

      });

      it('should skip updating the rollback tag if it is set to the current SHA', function () {
        var task = new GithubTags(makeGoodMockTask());

        task.updateRollbackTag('foobar');

        request.get.mostRecentCall.args[1](null, null, JSON.stringify({message: 'move along'}));

        expect(GithubTags.warning).toHaveBeenCalled();
        expect(GithubTags.prototype.updateTag).toHaveBeenCalled();

      });

      it('should try to update the rollback tag if the SHAs do not match', function () {
        var task = new GithubTags(makeGoodMockTask());

        task.updateRollbackTag('qwerty');

        request.get.mostRecentCall.args[1](null, null, JSON.stringify({message: 'move along'}));

        expect(request.patch).toHaveBeenCalled();

      });

      it('should create a new rollback tag if the tag is not found', function () {
        var task = new GithubTags(makeGoodMockTask());

        task.updateRollbackTag('qwerty');

        request.get.mostRecentCall.args[1](null, null, JSON.stringify({message: 'move along'}));
        request.patch.mostRecentCall.args[2](null, null, {message: 'Not Found'});

        expect(GithubTags.warning).toHaveBeenCalled();
        expect(GithubTags.prototype.newRollbackTag).toHaveBeenCalled();
      });

      it('should create a new rollback tag if the tag reference is not found', function () {
        var task = new GithubTags(makeGoodMockTask());

        task.updateRollbackTag('qwerty');

        request.get.mostRecentCall.args[1](null, null, JSON.stringify({message: 'move along'}));
        request.patch.mostRecentCall.args[2](null, null, {message: 'Reference does not exist'});

        expect(GithubTags.warning).toHaveBeenCalled();
        expect(GithubTags.prototype.newRollbackTag).toHaveBeenCalled();
      });

      it('should move on to updating the non-rollback tag', function () {
        var task = new GithubTags(makeGoodMockTask());

        task.updateRollbackTag('qwerty');

        request.get.mostRecentCall.args[1](null, null, JSON.stringify({message: 'move along'}));
        request.patch.mostRecentCall.args[2](null, null, {object: {sha: 'qwerty'}});

        expect(grunt.log.ok).toHaveBeenCalled();
        expect(GithubTags.prototype.updateTag).toHaveBeenCalled();
      });

    });

    describe('creating', function () {
      beforeEach(function () {
        spyOn(request, 'post');
        spyOn(GithubTags.prototype, 'updateTag');
        spyOn(grunt.log, 'ok');
      });

      it('should post to the correct Github API URL', function () {
        var task = new GithubTags(makeGoodMockTask());
        var expectedUrl = 'https://api.github.com/repos/TestUser/Example/git/refs/?oauth_token=abc123';
        var jsonParams = {json: {sha: 'qwerty', ref: 'refs/tags/rollback-' + packageInfo.version}};

        task.newRollbackTag('qwerty');

        expect(request.post).toHaveBeenCalled();

        expect(request.post.mostRecentCall.args[0]).toEqual(expectedUrl);
        expect(request.post.mostRecentCall.args[1]).toEqual(jsonParams);
      });

      it('should log that everything is OK upon creation', function () {
        var task = new GithubTags(makeGoodMockTask());

        task.newRollbackTag('qwerty');

        request.post.mostRecentCall.args[2](null, null, {object: {sha: 'qwerty'}});

        expect(grunt.log.ok).toHaveBeenCalled();
        expect(GithubTags.prototype.updateTag).toHaveBeenCalled();
      });

      it('should log anything else as a failure', function (done) {
        var task = new GithubTags(makeGoodMockTask(done));

        task.newRollbackTag('qwerty');

        request.post.mostRecentCall.args[2](null, null, {fail: 'this will fail'});

        expect(GithubTags.failed).toHaveBeenCalled();
      });
    });

  });

});
