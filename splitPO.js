/*
 * Created on Thu Aug 10 2017
 *
 * Copyright (c) 2017  by Shashank Maddela
 *
 * The file Splits sales order based on Vendor and Shipping Service Level
 */

function splitPO(poA) {
  this.poA = poA
  this.rType = 'purchaseorder'
  this.sublist = 'item'
  var sslF = 'custcol_ilt_ship_service_level' // 'item'
  var that = this
  var fieldsToWorkWith = ['item', 'custcol_vendor', 'quantity', 'rate', 'amount', 'createdpo', 'custcol_ilt_ship_service_level', 'custcol_ilt_is_drpsp_item', 'custcol_ilt_shipping_profile']

  function loadPO(poId) {
    console.log('that.rType: ' + that.rType)
    console.log('poId in loadPO: ' + poId)
    var r = nlapiLoadRecord(that.rType, poId)
    var lc = r.getLineItemCount(that.sublist)
    var record = []
    console.log('fieldsToWorkWith: ' + JSON.stringify(fieldsToWorkWith))
    console.log('lc: ' + lc)
    for (var i = 1; i <= lc; i++) {
      var line = {}
      for (var fInd = 0; fInd < fieldsToWorkWith.length; fInd++) {
        var f = fieldsToWorkWith[fInd]
        var v = r.getLineItemValue(that.sublist, f, i)
        line[f] = v
      }
      record.push(line)
    }

    nlapiLogExecution('DEBUG', 'record', JSON.stringify(record))
    return record
  }

  function combine(lineFieldsValues) {
    var combined = {}
    for (var ind in lineFieldsValues) {
      var lines = lineFieldsValues[ind]
      var vendor = lines.custcol_vendor
      var shipservicelevel = lines[sslF] // .custcol_ilt_ship_service_level
      if (!combined.hasOwnProperty(vendor)) {
        combined[vendor] = {}
      }

      if (!combined.hasOwnProperty(shipservicelevel)) {
        combined[vendor][shipservicelevel] = []
      }
    }
    return combined
  }

  function combineBySSL(lines) {
    var sslObj = {}
    for (var lInd in lines) {
      var line = lines[lInd]
      var ssl = line[sslF]
      if (!sslObj.hasOwnProperty(ssl)) {
        sslObj[ssl] = []
      }
      sslObj[ssl].push(line)
    }
    return sslObj
  }

  function createPOBasedOnSSL(linesBasedOnSSL) {
    var createdPOs = {}
    for (var ssl in linesBasedOnSSL) {
      if (linesBasedOnSSL.hasOwnProperty(ssl)) {
        var tr = nlapiCopyRecord(that.rType, that.getCurrentPOID())
        var rId = generateRecord(tr, linesBasedOnSSL[ssl])
        createdPOs[that.getCurrentPOID() + '|' + ssl] = rId
      }
    }
    return createdPOs
  }

  function generateRecord(r, lines) {
    var lc = r.getLineItemCount(that.sublist)
    for (var i = 1; i <= lc; i++) {
      r.removeLineItem(that.sublist, 1)
    }

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i]
      for (var fld in line) {
        if (line.hasOwnProperty(fld) && fieldsToSkip.indexOf(fld) === -1) {
          line[fld] = (fld === sslF || fld === that.sublist) ? parseInt(line[fld], 10) : line[fld]
          r.setLineItemValue(that.sublist, fld, i + 1, line[fld])
        }
      } // end of 'fld' for loop
    } // end of 'lines' for loop

    var rId = nlapiSubmitRecord(r)
    console.log('PO created: ' + rId)
    return rId
  }

  this.run = function (poId) {
    try {
      poId = parseInt(poId, 10)
      this.setCurrentPOID(poId)
      console.log(poId)
      var lines = loadPO(poId)
      console.log('lines: ' + JSON.stringify(lines))
      var linesBasedOnSSL = combineBySSL(lines)
      console.log('linesBasedOnSSL: ' + JSON.stringify(linesBasedOnSSL))
      var newPOs = createPOBasedOnSSL(linesBasedOnSSL)
      console.log('newPOs: ' + JSON.stringify(newPOs))
      return newPOs
    } catch (e) {
      console.log('Exception running: ' + JSON.stringify(e))
    }
  }

  this.setCurrentPOID = function (poId) {
    this.currentPOID = poId
  }

  this.getCurrentPOID = function () {
    return this.currentPOID
  }
}

splitPO.prototype.splitPOWrapper = function () {
  var poA = this.poA
  if (!Array.isArray(poA)) {
    poA = [poA]
  }
  for (var poId of poA) {
    var newPOs = this.run(poId)
  }
  return newPOs
}

// var r = new splitPO(44076760)
var r = new splitPO('44077204')
r.splitPOWrapper()

// var console = {
//   log: function (m1) {
//     nlapiLogExecution('DEBUG', '', m1)
//   }
// }
