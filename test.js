describe('gjallarhorn', function () {
  'use strict';

  var EventEmitter = require('events').EventEmitter
    , fork = require('child_process').fork
    , Gjallarhorn = require('./')
    , assume = require('assume')
    , path = require('path')
    , fixtures
    , ghorn;

  fixtures = require('fs').readdirSync(path.join(__dirname, 'fixtures'))
  .reduce(function reduce(memo, fixture) {
    memo[fixture.replace('.js', '')] = 1;
    return memo;
  }, {});

  fixtures.idonotexistlolcakes = 1;

  /* istanbul ignore next */
  function nope() {}

  beforeEach(function () {
    ghorn = new Gjallarhorn();

    ghorn.reload(function factory(name) {
      if (!(name in fixtures)) return false;

      return fork(path.join(__dirname, 'fixtures', name +'.js'), {
        silent: true
      });
    });
  });

  afterEach(function () {
    ghorn.destroy();
  });

  it('must accept an options object', function () {
    var g = new Gjallarhorn({ retries: 10 });

    assume(g.retries).equals(10);
    assume(g.concurrent).equals(256);
  });

  it('can be constructed without `new` keyword', function () {
    assume(Gjallarhorn()).is.instanceOf(Gjallarhorn);
  });

  describe('#reload', function () {
    it('sets a new child process generating factory', function () {
      assume(ghorn.factory).does.not.equal(nope);
      assume(ghorn.reload(nope)).equals(ghorn);
      assume(ghorn.factory).equals(nope);
    });
  });

  describe('#launch', function () {
    it('ignores the launch if false is returned from the factory', function () {
      assume(ghorn.active).has.length(0);
      assume(ghorn.queue).has.length(0);

      assume(ghorn.launch('wtf moo cows', nope)).is.false();

      assume(ghorn.active).has.length(0);
      assume(ghorn.queue).has.length(0);
    });

    it('returns a boolean as indication if a process is queued', function () {
      ghorn.active = new Array(ghorn.concurrent);

      assume(ghorn.queue).to.have.length(0);
      assume(ghorn.launch({spec: 'here'}, nope)).equals(false);
      assume(ghorn.queue).to.have.length(1);
    });

    it('does not launch if the factory returns nothing', function (next) {
      next = assume.plan(2, next);

      ghorn.reload(function (spec) {
        assume(spec).equals(1);

        return false;
      });

      assume(ghorn.launch(1, nope)).equals(false);
      next();
    });

    it('adds a timeout', function () {
      ghorn.launch('messages', nope);
      assume(ghorn.timers.active((ghorn.ids - 1) +':timeout')).is.true();
    });

    it('receives the send messages as data argument', function (next) {
      ghorn.launch('messages', function (err, data) {
        assume(data).is.a('array');
        assume(data).has.length(2);

        assume(data[0]).deep.equals({ message: 1 });
        assume(data[1]).deep.equals({ message: 2 });

        next();
      });
    });

    it('uses a `message` function as alternate to recieve messages', function (next) {
      next = assume.plan(6, next);

      ghorn.launch('messages', {
        message: function received(msg, round) {
          assume(msg.message).is.between(1, 2);
          assume(round).is.an('object');
        }
      }, function (err, data) {
        assume(data).is.a('array');
        assume(data).has.length(0);

        next();
      });
    });

    it('can set a custom timeout per launch', function (next) {
      ghorn.launch('timeout', {
        timeout: 200
      }, function (err) {
        assume(err.message).includes('timed out');
        assume(err.message).includes('200 ms');

        next();
      });
    });

    it('receives an error if the operation times out', function (next) {
      ghorn.timeout = 200;

      ghorn.launch('timeout', function (err) {
        assume(err.message).includes('timed out');
        assume(err.message).includes('200 ms');

        next();
      });
    });

    it('it retries if the process exits with 1', function (next) {
      ghorn.launch('one', function (err, messages) {
        assume(err.message).includes('failed');
        assume(err.message).includes('retrying');
        assume(messages).to.have.length(1);
        assume(messages[0]).to.equals('space face');

        next();
      });
    });

    it('it retries if the process dies instantly', function (next) {
      ghorn.launch('death', function (err) {
        assume(err.message).includes('failed');
        assume(err.message).includes('retrying');

        next();
      });
    });

    it('it retries if the process dies, slowly', function (next) {
      this.timeout(ghorn.retries * 1200);

      ghorn.launch('slow-death', function (err) {
        assume(err.message).includes('failed');
        assume(err.message).includes('retrying');

        next();
      });
    });

    it('works against non-existing files', function (next) {
      ghorn.launch('idonotexistlolcakes', function (err) {
        assume(err.message).includes('failed');
        assume(err.message).includes('retrying');

        next();
      });
    });

    it('can supply a custom retry option', function (next) {
      ghorn.launch('death', { retries: 5 }, function (err) {
        assume(err.message).includes('failed');
        assume(err.message).includes('retrying');

        next();
      });
    });

    it('handles child process error events correctly', function (next) {
      ghorn.launch('timeout', function (err) {
        assume(err.message).equals('custom error message');

        next();
      });

      var child;

      child= ghorn.active[0].ref;
      child.emit('error', new Error('custom error message'));

      child = ghorn.active[0].ref;
      child.emit('error', new Error('custom error message'));

      child = ghorn.active[0].ref;
      child.emit('error', new Error('custom error message'));
    });
  });

  describe('#next', function () {
    it('returns false if nothing can be processed', function () {
      assume(ghorn.next()).is.false();
    });

    it('returns false if active is full', function () {
      ghorn.active = new Array(ghorn.concurrent);
      ghorn.queue.push([0, nope]);

      assume(ghorn.next()).is.false();
    });

    it('launches the first of the queue', function (next) {
      var order = [];

      ghorn.active = new Array(ghorn.concurrent);

      ghorn.reload(function () {
        var ee = new EventEmitter();

        setTimeout(function () { ee.emit('exit', 0); }, 10);

        return ee;
      });

      ghorn.launch('foo', function () {
        order.push('first');
      });

      ghorn.launch('foo', function (err) {
        order.push('second');

        assume(order).deep.equals(['first', 'second']);
        next();
      });

      assume(ghorn.queue).is.length(2);
      assume(ghorn.next()).equals(false);

      ghorn.active.length = 0;
      assume(ghorn.next()).equals(true);
    });
  });

  describe('#clear', function () {
    it('only removes active items for the given id', function () {
      ghorn.launch('timeout', function () {});
      ghorn.launch('timeout', function () {});
      ghorn.launch('timeout', function () {});

      assume(ghorn.active).has.length(3);

      assume(ghorn.active[0].id).equals(0);
      assume(ghorn.active[1].id).equals(1);
      assume(ghorn.active[2].id).equals(2);

      assume(ghorn.clear(0)).equals(ghorn);

      assume(ghorn.active).has.length(2);
      assume(ghorn.active[0].id).equals(1);
      assume(ghorn.active[1].id).equals(2);
    });

    it('calls the callback for the given id with an error', function (next) {
      /* istanbul ignore next */
      ghorn.launch('timeout', function () {});

      ghorn.launch('timeout', function (err) {
        assume(err).is.a('error');
        assume(err.message).equals('custom message');

        next();
      });

      /* istanbul ignore next */
      ghorn.launch('timeout', function () {});

      ghorn.clear(1, new Error('custom message'));
    });

    it('calls the callback for the given id with supplied messages', function (next) {
      ghorn.launch('timeout', function (err, messages) {
        assume(err).is.a('undefined');
        assume(messages).is.a('array');
        assume(messages[0]).equals('hello');

        next();
      });

      ghorn.clear(0, undefined, ['hello']);
    });
  });

  describe('#again', function () {
    it('cannot try again if there are no more retries', function () {
      assume(ghorn.again({ retries: 0 })).equals(false);
    });

    it('clears and re-launches if it can try again', function (next) {
      ghorn.reload(function (spec) {
        assume(spec).equals('lol');
        next();
      });

      assume(ghorn.again({ fn: nope, retries: 1, spec: 'lol' })).equals(true);
    });

    it('can be called after the instance is destroyed', function () {
      ghorn.destroy();
      assume(ghorn.again({ fn: nope, retries: 0, spec: 'lol' })).equals(true);
    });
  });

  describe('#has', function () {
    it('finds an active child process', function () {
      ghorn.launch('one', function (err) {

      });

      assume(ghorn.active).to.have.length(1);
      assume(ghorn.has('nope')).to.equal(false);
      assume(ghorn.has('1')).to.equal(false);
      assume(ghorn.has(0)).to.equal(true);
      assume(ghorn.has(1)).to.equal(false);
    });
  });

  describe('#destroy', function () {
    it('returns false when its already destroyed', function () {
      assume(ghorn.destroy()).is.true();
      assume(ghorn.destroy()).is.false();
      assume(ghorn.destroy()).is.false();
      assume(ghorn.destroy()).is.false();
    });

    it('clears all active processes with an cancel error', function (next) {
      ghorn.reload(function () {
        return new EventEmitter();
      });

      ghorn.launch({ payload: 1 }, function (err) {
        assume(err.message).includes('cancel');

        setTimeout(function () {
          assume(ghorn.active).has.length(0);
          assume(ghorn.queue).has.length(0);

          next();
        }, 10);
      });

      assume(ghorn.queue).has.length(0);
      assume(ghorn.active).has.length(1);

      ghorn.destroy();
    });

    it('clears all queued processes with an cancel error', function (next) {
      ghorn.active = new Array(ghorn.concurrent);

      ghorn.launch({ payload: 1 }, function (err) {
        assume(err.message).includes('cancel');

        setTimeout(function () {
          assume(ghorn.queue).has.length(0);
          assume(ghorn.active).has.length(0);

          next();
        }, 10);
      });

      assume(ghorn.queue).has.length(1);

      ghorn.destroy();
    });
  });
});
