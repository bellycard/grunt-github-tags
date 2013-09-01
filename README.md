# grunt-github-tags

> Set tags for a repo on Github.

## Getting Started
This plugin requires Grunt `~0.4.1`

If you haven't used [Grunt](http://gruntjs.com/) before, be sure to check out the [Getting Started](http://gruntjs.com/getting-started) guide, as it explains how to create a [Gruntfile](http://gruntjs.com/sample-gruntfile) as well as install and use Grunt plugins. Once you're familiar with that process, you may install this plugin with this command:

```shell
npm install grunt-github-tags --save-dev
```

Once the plugin has been installed, it may be enabled inside your Gruntfile with this line of JavaScript:

```js
grunt.loadNpmTasks('grunt-github-tags');
```

## The "githubTags" task

### Overview
Easily define and set tags on Github according to your local SHA.

To get started set options like so:

```
githubCredentials: grunt.file.readJSON('github-credentials.json'),
githubTags: {
  options: {
    owner: '<%= githubCredentials.owner %>',
    repo: '<%= githubCredentials.repo %>',
    oauthToken: '<%= githubCredentials.oauth_token %>'
  },
  production: {
    options: {
      rollback: true,
      tag: 'production'
    }
  },
  staging: {
    options: {
      tag: 'staging'
    }
  }
  release: {}
}
```
See below for more configuation information.

## Options

### options.owner
**Required**

Type: `String`

The Github repo owner. Could be a user name or organization name.

### options.repo
**Required**

Type: `String`

The Github repository.

### options.oauthToken
**Required**

Type: `String`

The Github API OAuth token. At the current time this must be supplied. GithubTags will not authenticate with the Github API.

### options.tag

Type: `String`

Default: version number from local package.json file

The name of the tag that will be set to the current SHA.

### options.rollback

Type: `Boolean`

Set to true to set a rollback of the tag to be set. The rollback tag will be set to the tags last known SHA. If this is the first time a rollback is create the SHA will be the same as the tag being set. Useful for deployments that use tags.

*Example*:

Tag to be set is `production`. Rollback will be automatically set to `rollback-production`.

* Last known `production` SHA ro456789b5fdbe6a568b25997251f123dae201c3

* new `production` SHA 2e1230c98e456756eb7c65baa32baf313bfc4267

* SHA for `rollback-production` will be ro456789b5fdbe6a568b25997251f123dae201c3

## Testing
In lieu of NodeUnit this project uses Jasmine-Node. To run tests run `npm test` which will lint code and run specs.

## Contributing
In lieu of a formal styleguide, take care to maintain the existing coding style. Add unit tests for any new or changed functionality. Lint and test your code using `npm test`.

## Todos
* Clean up specs
* Check if tag sha has changed in same fashion as rollback check
* Add in success message handler in similar fashion as `failed` and `warning`

## Release History
* 2013-08-31  v0.2.0  Add tests and working release
* 2013-08-30  v0.1.0  Initial release

For a proper list of changes, take a look at the [changelog](https://github.com/bellycard/grunt-github-tags/blob/master/CHANGELOG.md)
