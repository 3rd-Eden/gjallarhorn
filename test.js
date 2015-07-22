describe('gjallarhorn', function () {
  'use strict';

  var Gjallarhorn = require('./')
    , assume = require('assume')
    , ghorn;

  beforeEach(function () {
    ghorn = new Gjallarhorn();
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

    it('receives the send messages as data argument');
    it('receives an error if the operation times out');
    it('receives an error if re-tries to many times');
    it('decreases the active items');
    it('starts a new item from the queue on completion');
    it('can supply a custom retry option');
    it('retries failed processes');
    it('adds a timeout');
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

    it('clears all active processes with an cancel error');
    it('clears all queued processes with an cancel error');
  });
});
