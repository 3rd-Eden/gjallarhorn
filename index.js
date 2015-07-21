'use strict';

var TickTock = require('tick-tock')
  , ms = require('millisecond')
  , Ultron = require('ultron')
  , one = require('one-time');

/**
 * Representation of a spawned or to-spawn process.
 *
 * @param {String} id Unique id
 * @param {ChildProcess} ref Reference to the spawned child process.
 * @param {Function} fn Completion callback.
 * @api private
 */
function Round(id, ref, fn) {
  this.ref = ref;
  this.id = id;
  this.fn = fn;
}

/**
 * A small child-process management utility.
 *
 * @constructor
 * @param {Object} options Configuration of the instance.
 * @api public
 */
function Gjallarhorn(options) {
  if (!this) return new Gjallarhorn(options);
  options = options || {};

  this.retries = options.retries || 3;
  this.concurrent = options.concurrent || 256;
  this.interval = ms(options.interval || '50 ms');
  this.timeout = ms(options.timeout || '30 seconds');
  this.factory = options.factory;

  this.ids = 0;
  this.queue = [];
  this.active = [];
  this.timers = new TickTock(this);
}

/**
 * Set a new child process generating factory.
 *
 * @param {Function} factory The function that generates the child processes
 * @returns {Gjallarhorn}
 * @api public
 */
Gjallarhorn.prototype.reload = function reload(factory) {
  this.factory = factory;
  return this;
};

/**
 * Launch a new process.
 *
 * @param {Object} spec Details that needs to be passed in to the factory.
 * @param {Function} fn Completion callback.
 * @returns {Boolean} Indication if launch was processed directly.
 * @api public
 */
Gjallarhorn.prototype.launch = function launch(spec, fn) {
  if (this.active.length === this.concurrent) {
    this.queue.push({ spec: spec, fn: fn });
    return false;
  }

  var rocket;

  if (!this.factory || !(rocket = this.factory(spec))) return false;
  this.tracking(rocket, fn);

  return true;
};

/**
 * Track a given child process.
 *
 * @return {[type]} [description]
 */
Gjallarhorn.prototype.tracking = function tracking(ref, fn) {
  var id = this.ids++
    , self = this;

  this.timers.setTimeout(id +':timeout', function () {
    self.clear(id, new Error('Operation timed out after '+ self.timeout +'ms'));
  }, this.timeout);

  ref.once('exit', function exit(code, signal) {
    self.clear(id);
  });
};

/**
 * @param {String} id Id of the child that needs to be cleaned up.
 * @api private
 */
Gjallarhorn.prototype.clear = function clear(id, err) {
  this.active = this.active.filter(function filter(round) {
    if (id !== round.id) return false;

    round.fn(err);

    round.ref.remove
    round.ref.kill(err ? 1 : 0);

    return true;
  });

  this.timers.clear(id +':timeout');
  return this;
};

/**
 * Completely destroy the Gjallarhorn instance.
 *
 * @returns {Boolean}
 * @api private
 */
Gjallarhorn.prototype.destroy = function destroy() {
  if (!this.timers) return false;

  var cancel = new Error('Operation cancelled, instance destroyed');

  //
  // Kill all active processes.
  //
  this.active.forEach(function each(round) {
    this.clear(round.id, cancel);
  }, this);

  //
  // Notify queued calls of destruction.
  //
  this.queue.forEach(function (queued) {
    queued.fn(cancel);
  });

  //
  // Clean up all existing references.
  //
  this.queue.length = this.active.length = 0;
  this.timers.destroy();
  this.factory = null;

  return true;
};

//
// Expose the module's primary interface.
//
module.exports = Gjallarhorn;
