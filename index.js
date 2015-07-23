'use strict';

var TickTock = require('tick-tock')
  , ms = require('millisecond')
  , Ultron = require('ultron')
  , one = require('one-time');

/**
 * Representation of a spawned or to-spawn process.
 *
 * @param {String} id Unique id
 * @param {Object} spec Specification used to spawn childs.
 * @param {ChildProcess} ref Reference to the spawned child process.
 * @param {Function} fn Completion callback.
 * @api private
 */
function Round(id, spec, ref, retries, fn) {
  this.events = new Ultron(ref);
  this.retries = retries - 1;
  this.spec = spec;
  this.ref = ref;
  this.id = id;
  this.fn = fn;
}

/**
 * A small child-process management utility.
 *
 * Options:
 *
 * - timeout: Maximum time a spawned child process is allowed to stay alive.
 * - concurrent: Maximum number of concurrent processes we're allowed to spawn.
 * - retries: How many times we're allowed to (re)execute a failed process.
 * - factory: A function that generates your child processes.
 *
 * @constructor
 * @param {Object} options Configuration of the instance.
 * @api public
 */
function Gjallarhorn(options) {
  if (!this) return new Gjallarhorn(options);
  options = options || {};

  this.timeout = ms(options.timeout || '30 seconds');
  this.concurrent = options.concurrent || 256;
  this.retries = options.retries || 3;
  this.factory = options.factory;

  this.timers = new TickTock(this);
  this.active = [];
  this.queue = [];
  this.ids = 0;
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
 * @param {Object} options Addition configuration.
 * @param {Function} fn Completion callback.
 * @returns {Boolean} Indication if launch was processed directly.
 * @api public
 */
Gjallarhorn.prototype.launch = function launch(spec, options, fn) {
  if ('function' === typeof options) {
    fn = options;
    options = {};
  }

  options.retries = 'retries' in options ? options.retries : this.retries;

  if (this.active.length === this.concurrent) {
    this.queue.push([ spec, options, fn ]);
    return false;
  }

  var ref;

  if (!this.factory || !(ref = this.factory(spec))) return false;
  this.tracking(new Round(this.ids++, spec, ref, options.retries, one(fn)));

  return true;
};

/**
 * Check if we need to run another item from our queue.
 *
 * @returns {Boolean}
 * @api private
 */
Gjallarhorn.prototype.next = function next() {
  if (!this.queue.length || this.active.length === this.concurrent) return false;

  return this.launch.apply(this, this.queue.shift());
};

/**
 * Check if we need to the given process again.
 *
 * @param {Round} round The round that failed.
 * @returns {Boolean} Are we retrying.
 * @api private
 */
Gjallarhorn.prototype.again = function again(round) {
  if (!round.retries) return false;

  //
  // Create a back up of the callback as we don't really want it to be called in
  // our `clear` call as we're not done yet.
  //
  var fn = round.fn;
  round.fn = function nope() {};

  this.clear(round.id);
  this.launch(round.spec, round, fn);

  return true;
};

/**
 * Track a given child process.
 *
 * @param {Round} round Child process information
 * @api private
 */
Gjallarhorn.prototype.tracking = function tracking(round) {
  var self = this
    , id = round.id
    , messages = [];

  /**
   * According to the documentation it's possible that `exit` is not called in
   * case of an error. So we need to have a general function that can handle
   * both errors from the `error` event and bad exit codes from the `exit`
   * event.
   *
   * @param {Error|Number} err
   * @api private
   */
  function retry(err) {
    if (err) {
      if (self.again(round)) return;
      if ('number' === typeof err) err = new Error('Operation failed after retrying');
    }

    self.clear(id, err, messages || []);
    self.next();
  }

  self.timers.setTimeout(id +':timeout', function timeout() {
    if (self.again(round)) return;

    self.clear(id, new Error('Operation timed out after '+ self.timeout +' ms'), messages);
    self.next();
  }, self.timeout);

  round.events
  .once('exit', retry)
  .once('error', retry)
  .on('message', function message(data) {
    messages.push(data);
  });

  this.active.push(round);
};

/**
 * Clean a round as it's execution process has been completed.
 *
 * @param {String} id Id of the child that needs to be cleaned up.
 * @param {Error} err Optional error argument if the we failed.
 * @param {Array} messages All the received messages from this process.
 * @api private
 */
Gjallarhorn.prototype.clear = function clear(id, err, messages) {
  this.active = this.active.filter(function filter(round) {
    if (id !== round.id) return false;

    round.fn(err, messages);

    round.events.remove();

    try { round.ref.kill(); }
    catch (e) {}

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
  this.queue.forEach(function each(queued) {
    if ('function' === typeof queued[1]) queued[1](cancel);
    else queued[2](cancel);
  });

  //
  // Clean up all existing references.
  //
  this.queue.length = this.active.length = 0;
  this.timers.destroy();
  this.factory = this.timers = null;

  return true;
};

//
// Expose the module's primary interface.
//
module.exports = Gjallarhorn;
