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

  beforeEach(function () {
    ghorn = new Gjallarhorn();

    ghorn.reload(function factory(name) {
      if (!(name in fixtures)) return false;

      return fork(path.join(__dirname, 'fixtures', name +'.js'));
    });
  });

  afterEach(function () {
    ghorn.destroy();
  });

  it('must accept an options object', function () {
    var g = new Gjallarhorn({ retries: 10,  });

    assume(g.retries).equals(10);
    assume(g.concurrent).equals(256);
  });

  it('can be constructed without `new` keyword', function () {
    assume(Gjallarhorn()).is.instanceOf(Gjallarhorn);
  });

  describe('#reload', function () {
    it('sets a new child process generating factory', function () {
      function factory() {
      }

      assume(ghorn.factory).does.not.equal(factory);
      assume(ghorn.reload(factory)).equals(ghorn);
      assume(ghorn.factory).equals(factory);
    });
  });

  describe('#launch', function () {
    it('returns a boolean as indication if a process is queued', function () {
      ghorn.active = new Array(ghorn.concurrent);

      ghorn.reload(function () {
        return {};
      });

      assume(ghorn.queue).to.have.length(0);
      assume(ghorn.launch({spec: 'here'}, function () {})).equals(false);
      assume(ghorn.queue).to.have.length(1);
    });

    it('does not launch if the factory returns nothing', function (next) {
      next = assume.plan(2, next);

      ghorn.reload(function (spec) {
        assume(spec).equals(1);

        return false;
      });

      assume(ghorn.launch(1, function () {})).equals(false);
      next();
    });

    it('adds a timeout', function () {
      ghorn.launch('messages', function () {});
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

    it('receives an error if the operation times out', function (next) {
      ghorn.timeout = 200;

      ghorn.launch('timeout', function (err) {
        assume(err.message).includes('timed out');
        assume(err.message).includes('200 ms');

        next();
      });
    });

    it('receives an error if re-tries to many times', function (next) {
      ghorn.launch('death', function (err) {
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

    it('decreases the active items');
    it('starts a new item from the queue on completion');
    it('retries failed processes');
  });

  describe('#next', function () {
    it('returns false if active is full');
    it('launches the first of the queue');
  });

  describe('#again', function () {
    it('cannot try again if there are no more retries');
    it('clears and re-launches if it can try again');
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

    it('clears all queued processes with an cancel error', function () {
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
