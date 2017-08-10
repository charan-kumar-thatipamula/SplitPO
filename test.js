function testOne() {
  this.setV = function (value) {
    this.v = value
  }

  this.getV = function () {
    return this.v
  }
  this.run = function () {
    this.setV('I am being set')
    console.log(this.getV())
  }
}

testOne.prototype.func1 = function () {
  this.run()
}

var r = new testOne()
r.func1()