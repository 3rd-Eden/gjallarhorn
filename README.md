# [gjallarhorn](https://youtu.be/uEekQYXh5vg)

[![Version npm][version]](http://browsenpm.org/package/gjallarhorn)[![Build Status][build]](https://travis-ci.org/3rd-Eden/gjallarhorn)[![Dependencies][david]](https://david-dm.org/3rd-Eden/gjallarhorn)[![Coverage Status][cover]](https://coveralls.io/r/3rd-Eden/gjallarhorn?branch=master)

[version]: https://img.shields.io/npm/v/gjallarhorn.svg?style=flat-square
[build]: https://img.shields.io/travis/3rd-Eden/gjallarhorn/master.svg?style=flat-square
[david]: https://img.shields.io/david/3rd-Eden/gjallarhorn.svg?style=flat-square
[cover]: https://img.shields.io/coveralls/3rd-Eden/gjallarhorn/master.svg?style=flat-square

Gjallarhorn is a small module that allows you to easily orchestrate multiple
child processes without accidentally bombing your self. It has concurrency
control, retry and timeout management. Everything you need to launch new
processes.

## Installation

Module is released in the public npm registry and can be installed by running.

```js
npm install --save gjallarhorn
```

## Usage

In all code examples we assume that you've already required and setup your first
Gjallarhorn using:

```js
'use strict';

var Gjallarhorn = require('gjallarhorn')
  , ghorn = new Gjallarhorn(/* options */);
```

In the example above you can see that we accept one optional argument in the
constructor which an options object that can contain the following properties:

- `timeout` Maximum time a spawned child process is allowed to stay alive. This
  can be a number a milliseconds or a human readable string that can be parsed
  using the [millisecond](https://github.com/unshift/millisecond) module.
  Defaults to `30 seconds`
- `concurrency` Limits the amount of child processes that can be ran in
  parallel. Make sure that you do not bump this setting to high as you might
  overload your server with to many processes. Defaults to `256`.
- `retries` How many times are we allowed to retry to start a new child process
  in case of error or failure? Defaults to `3`
- `factory` A function that generates the actual child processes. See
  [Factory](#factory) for more detailed information.

### Factory

Gjallarhorn it self does not create the child processes for you, instead it
orchestrates the onces that you create. In order to make this process easier you
have to supply us with a function that creates/spawns/forks a nice child process
and returns it to use. This can function can either be supplied in the
constructor using the `factory` property of the options object or set using the
`reload` method.

The factory function receives the instructions that you supply in the `launch`
method. This allows you to dynamically spawn child processes. Below is a small
example that uses `fork` to create a child process and pass data to it using
Node's internal IPC (Inter Process Communication) channel.

```js
var fork = require('child_process').fork;

ghorn.reload(function generate(spec) {
  var whatthe = fork('./path/to/example.js', {
    silent: true // Do no inherit the std/in/out of this process.
  });

  whatthe.send(spec);
  return whathe;
});

ghorn.launch({ data: 'send' }, function (err, messages) {
  // done or dead
});
```

If the nothing is returned by the factory function we assume that no process
should be spawned and no orchestration is required.

### API

The following methods are available on the constructed instance:

#### reload

The `reload` method allows you to update the supplied child process factory. Or
set it if you haven't set it before using the `factory` option. Please see
[Factory](#factory) for more detailed information about this method and why it's
required.

#### launch

Launch a new process. This method accepts 3 arguments:

- `spec` The information that needs to be passed in to the [Factory](#factory)
  that you specified.
- `options` Optional object which allows you to individually configure certain
  options:
  - `retries` Set the amount of retries per spawned process. This allows you to
  bump, or just completely disable them.
- `fn` A completion callback which will be called using the error first callback
  pattern. The second argument that this function receives is an array of
  `messages` that we're received from the child process.

The method returns a boolean which can be used as indication to see if child
process was executed directly or queued. *true* indicates a successful
activation while *false* indicates a queued operation.

A process might be queued when the concurrency limit has been reached. The
process will be added in a queue that tries to follow a FIFO order. If for some
reason your child process fails, it will *not* be send back in the queue but
retried immediately.

```js
ghorn.launch({ data: 'send'}, { retries: 10 }, function (err, messages) {
  //
  // An error could be set if the child process timed out or when an exception
  // occured in the process more than the set retries.
  //
  if (err) console.error('shit broke, ', err);

  //
  // The messages array contains all information that was send by a child
  // process using the `process.send` functionality.
  //
});
```

#### destroy

Completely destroy the `Gjallarhorn` instance. This will **kill** all running
and queued processes causing them be called with an error in the supplied
callbacks. After the `destroy` method is used, none of the other API methods
should be invoked as it will lead to errors.

```js
ghorn.destroy();
```

## License

MIT
