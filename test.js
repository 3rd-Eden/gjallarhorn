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

    });

    it('does not launch if the factory returns nothing', function (next) {
      next = assume.plan(2, next);

      ghorn.reload(function (spec) {
        assume(spec).equals(1);

        return false;
      });

      assume(ghorn.launch(1)).equals(false);
      next();
    });

    it('limits the amount of concurrent processes');
    it('implements a ping/pong strategy');
    it('retries failed processes');
    it('adds a timeout');
  });
});
