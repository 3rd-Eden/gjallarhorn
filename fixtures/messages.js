process.send({ message: 1 });

setTimeout(function () {
  process.send({ message: 2 });
}, 100);
