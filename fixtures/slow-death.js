setTimeout(function () {
  throw new Error('slow, async death');
}, 1000);
