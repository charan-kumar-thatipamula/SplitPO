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
  this.poF = 'custcol_po_number'
  this.cSOID = ''
  var sslF = 'custcol_ilt_ship_service_level' // 'item'
  var that = this
  var fieldsToWorkWith = ['item', 'custcol_vendor', 'quantity', 'rate', 'amount', 'createdpo', 'custcol_ilt_ship_service_level', 'custcol_ilt_is_drpsp_item', 'custcol_ilt_shipping_profile', 'custcol_ilt_dont_ship_before', 'custcol_ilt_dont_ship_after', 'custcol_lum_ven_must_ship']
  var fieldsToSkip = []
  var srType = 'salesorder'
  var dnsBfrF = 'custcol_ilt_dont_ship_before'
  var dnsAftrF = 'custcol_ilt_dont_ship_after'
  var msByF = 'custcol_lum_ven_must_ship'
  // var sslMap = {}
  var doneF = 'custbody_ilt_po_split_done'
  function loadPO(poId) {
    // console.log('that.rType: ' + that.rType)
    // console.log('poId in loadPO: ' + poId)
    nlapiLogExecution('AUDIT', 'Loading PO', 'PO #: ' + poId)
    var r = nlapiLoadRecord(that.rType, poId)
    var lc = r.getLineItemCount(that.sublist)
    var record = []
    // console.log('fieldsToWorkWith: ' + JSON.stringify(fieldsToWorkWith))
    // console.log('lc: ' + lc)
    for (var i = 1; i <= lc; i++) {
      var line = {}
      for (var fInd = 0; fInd < fieldsToWorkWith.length; fInd++) {
        var f = fieldsToWorkWith[fInd]
        var v = r.getLineItemValue(that.sublist, f, i)
        if (f === sslF) {
          // sslMap[v] = r.getLineItemValue(that.sublist, f + '_display', i)
          // v = r.getLineItemValue(that.sublist, f, i)
          // sslMap[v] = r.getLineItemValue(that.sublist, f, i)
          line[f] = [r.getLineItemValue(that.sublist, f + '_display', i), v] // ['3 Day Select', '16'] Id for same ssl can be diff. based on shipping profile
        } else {
          // v = r.getLineItemValue(that.sublist, f, i)
          line[f] = v
        }
      }
      record.push(line)
    }

    nlapiLogExecution('AUDIT', 'PO loaded PO #: ' + poId, JSON.stringify(record))
    // nlapiLogExecution('DEBUG', 'Shipping service level map', JSON.stringify(sslMap))
    return record
  }

  // function combine(lineFieldsValues) {
  //   var combined = {}
  //   for (var ind in lineFieldsValues) {
  //     var lines = lineFieldsValues[ind]
  //     var vendor = lines.custcol_vendor
  //     var shipservicelevel = lines[sslF] // .custcol_ilt_ship_service_level
  //     if (!combined.hasOwnProperty(vendor)) {
  //       combined[vendor] = {}
  //     }

  //     if (!combined.hasOwnProperty(shipservicelevel)) {
  //       combined[vendor][shipservicelevel] = []
  //     }
  //   }
  //   return combined
  // }

  function combineBySSL(lines) {
    var sslObj = {}
    for (var lInd = 0; lInd < lines.length; lInd++) {
      var line = lines[lInd]
      var ssl = line[sslF].length ? line[sslF][0] : ''
      line[sslF] = line[sslF][1]
      if (ssl && ssl.length && !sslObj.hasOwnProperty(ssl)) {
        sslObj[ssl] = []
      }
      sslObj[ssl].push(line)
    }
    nlapiLogExecution('DEBUG', 'Combined lines using Shispping Service Level', JSON.stringify(sslObj))
    return sslObj
  }

  function createPOBasedOnSSL(linesBasedOnSSL) {
    var createdPOs = {}
    // console.log('that.getCurrentPOID(): ' + that.getCurrentPOID())
    var r = nlapiLoadRecord(that.rType, that.getCurrentPOID())
    that.setCurrenSOID(r.getFieldValue('createdfrom'))
    // console.log('that.getCurrentSOID(): ' + that.getCurrentSOID())
    for (var ssl in linesBasedOnSSL) {
      if (linesBasedOnSSL.hasOwnProperty(ssl)) {
        nlapiLogExecution('DEBUG', 'Start PO creation', 'Creating PO for Shipping Service Level: ' + ssl)
        var tr = nlapiCopyRecord(that.rType, that.getCurrentPOID())
        var rId = generateRecord(tr, linesBasedOnSSL[ssl], ssl)
        nlapiLogExecution('AUDIT', 'PO Created for ssl: ' + ssl, 'PO #: ' + rId)
        createdPOs[r.getFieldValue('entity') + '|' + ssl] = rId
      }
    }
    // console.log('createdPOs: ' + JSON.stringify(createdPOs))
    nlapiLogExecution('DEBUG', 'createdPOs: ', JSON.stringify(createdPOs))
    for (var i = 1; i <= r.getLineItemCount(that.sublist); i++) {
      r.setLineItemValue(that.sublist, 'isclosed', i, 'T')
    }
    nlapiSubmitRecord(r)
    // console.log('Closed all line items of PO: ' + that.getCurrentPOID())
    nlapiLogExecution('AUDIT', 'Closed all line items of PO: ' + that.getCurrentPOID())
    return createdPOs
  }

  function generateRecord(r, lines, ssl) {
    var lc = r.getLineItemCount(that.sublist)
    for (var i = 1; i <= lc; i++) {
      r.removeLineItem(that.sublist, 1)
    }

    // console.log('r.getLineItemCount() after removing: ' + r.getLineItemCount(that.sublist))
    var dnsBfr = ''
    var dnsAftr = ''
    var msBy = ''
    for (var i = 0; i < lines.length; i++) {
      nlapiLogExecution('DEBUG', 'Starting: ssl, line, dnsBfr, dnsAftr, msBy', ssl + ', ' + i + ', ' + dnsBfr + ', ' + dnsAftr + ', ' + msBy)      
      var line = lines[i]
      nlapiLogExecution('DEBUG', 'line', JSON.stringify(line))      
      for (var fld in line) {
        if (line.hasOwnProperty(fld) && fieldsToSkip.indexOf(fld) === -1) {
          // setDateFields(fld, line, dnsBfr, dnsAftr, msBy)
          switch (fld) {
            case dnsBfrF :
              dnsBfr = getMin(dnsBfr, fld, line)
              break
            case dnsAftrF : 
              dnsAftr = getMin(dnsAftr, fld, line)
              break
            case msByF : 
              msBy = getMin(msBy, fld, line)
              break
          }
          line[fld] = (fld === sslF || fld === that.sublist) ? parseInt(line[fld], 10) : line[fld]
          r.setLineItemValue(that.sublist, fld, i + 1, line[fld])
        }
      } // end of 'fld' for loop
      nlapiLogExecution('DEBUG', 'Ending: ssl, line, dnsBfr, dnsAftr, msBy', ssl + ', ' + i + ', ' + dnsBfr + ', ' + dnsAftr + ', ' + msBy)      
    } // end of 'lines' for loop

    nlapiLogExecution('DEBUG', 'dnsBfr, dnsAftr, msBy', dnsBfr + ', ' + dnsAftr + ', ' + msBy)
    r.setFieldValue('shipdate', dnsBfr)
    r.setFieldValue('custbody_ilt_dont_ship_after', dnsAftr)
    r.setFieldValue('custbody_ilt_must_ship_by', msBy)

    nlapiLogExecution('DEBUG', 'shipmethod', ssl) // sslMap[ssl])
    r.setFieldText('shipmethod', ssl) // sslMap[ssl])
    // console.log('r.getLineItemCount() after updating with new line values: ' + r.getLineItemCount(that.sublist))
    var rId =  nlapiSubmitRecord(r)
    // console.log('PO created: ' + rId)

    return rId
  }

  function getMin(dStr, fld, line) {
    if (!dStr || !dStr.length) {
      nlapiLogExecution('DEBUG', 'dStr, fld, line[fld]', dStr + ', ' + fld + ', ' + line[fld])
      return line[fld]
    }
    dStr = new Date(dStr) < new Date(line[fld]) ? dStr : line[fld]
    return dStr
  }

  // function setDateFields(fld, line, dnsBfr, dnsAftr, msBy) {
  //   switch (fld) {
  //     case 'custcol_ilt_dont_ship_before' :
  //       return getMin(dnsBfr, fld, line)
  //     case 'custcol_ilt_dont_ship_after' : 
  //       return getMin(dnsAftr, fld, line)
  //     case 'custcol_lum_ven_must_ship' : 
  //       return getMin(msBy, fld, line)
  //     default:
  //       return
  //   }
  //   // if (fld === 'custcol_ilt_dont_ship_before') {
  //   //   return getMin(dnsBfr, fld, line)
  //   // } else if (fld === 'custcol_ilt_dont_ship_after') {
  //   //   return getMin(dnsAftr, fld, line)
  //   // } else if (fld === 'custcol_lum_ven_must_ship') {
  //   //   return getMin(msBy, fld, line)
  //   // } else {
  //   //   return
  //   // }

  //   function getMin(dStr, fld, line) {
  //     if (!dStr || !dStr.length) {
  //       dStr = line[fld]
  //     }
  //     dStr = new Date(dStr) < new Date(line[fld]) ? dStr : line[fld]
  //   }
  // }

  function updateSO(soId, newPOs) {
    // console.log('soId: ' + soId)
    nlapiLogExecution('AUDIT', 'Updating the sales order with PO numbers', 'Sales order #:' + soId)
    var r = nlapiLoadRecord(srType, soId)
    for (var i = 1; i <= r.getLineItemCount(that.sublist); i++) {
      var isDrpshpItem = r.getLineItemValue(that.sublist, 'custcol_ilt_is_drpsp_item', i) || 'F'
      if (isDrpshpItem !== 'T') {
        continue
      }
      var poId = that.getCurrentPOID()
      if (newPOs && typeof newPOs === 'object') {
        // console.log('r.getLineItemValue(that.sublist, \'custcol_ilt_vendor_name\', ' + i + '): ' + r.getLineItemValue(that.sublist, 'custcol_ilt_vendor_name', i))
        // console.log('r.getLineItemValue(that.sublist, sslF,  ' + i + '): ' + r.getLineItemValue(that.sublist, sslF, i))
        var key = r.getLineItemValue(that.sublist, 'custcol_ilt_vendor_name', i) + '|' + r.getLineItemValue(that.sublist, sslF + '_display', i)
        // console.log('key: ' + key)
        poId = newPOs[key]
      }
      // console.log('Updating line number ' + i + ' with poId: ' + poId)
      nlapiLogExecution('DEBUG', 'Updating line', 'line Number: ' + i + 'PO Id: ' + poId)
      r.setLineItemValue(that.sublist, that.poF, i, poId)
    }
    r.setFieldValue(doneF, 'T')
    nlapiSubmitRecord(r)
    // console.log('Updated line items of SO: ' + soId)
    nlapiLogExecution('AUDIT', 'Updated line items with PO numbers', 'SO #' + soId)
  }

  function isSplitRequired(lines) {
    var count = 0
    for (var k in lines) {
      if (lines.hasOwnProperty(k)) {
        count++
      }
      if (count > 1) {
        // console.log('split required. Multiple shipping service levels found')
        nlapiLogExecution('DEBUG', 'Split eligibility', 'split required. Multiple shipping service levels found')
        return true
      }
    }
    // console.log('split not required. There is only one Shipping service level across all line items.')
    nlapiLogExecution('DEBUG', 'Split eligibility', 'split not required. There is only one Shipping service level across all line items.')
    return false
  }

  this.run = function (poId) {
    try {
      nlapiLogExecution('DEBUG', 'Current Purchase order Id: ', poId)
      poId = parseInt(poId, 10)
      // console.log('Current Purchase Order ID: ' + poId)
      this.setCurrentPOID(poId)
      // console.log(poId)
      var lines = loadPO(poId)
      // console.log('lines: ' + JSON.stringify(lines))
      var newPOs = ''
      if (isSplitRequired(lines)) {
        var linesBasedOnSSL = combineBySSL(lines)
        // console.log('linesBasedOnSSL: ' + JSON.stringify(linesBasedOnSSL))
        newPOs = createPOBasedOnSSL(linesBasedOnSSL)
        // console.log('newPOs: ' + JSON.stringify(newPOs))
      }
      updateSO(this.getCurrentSOID(), newPOs)
      return newPOs
    } catch (e) {
      // console.log('Exception running: ' + JSON.stringify(e))
      nlapiLogExecution('ERROR', 'Exception running PO Split', JSON.stringify(e))
    }
  }

  this.setCurrentPOID = function (poId) {
    this.currentPOID = poId
  }

  this.getCurrentPOID = function () {
    return this.currentPOID
  }

  this.setCurrenSOID = function (soID) {
    this.cSOID = soID
  }

  this.getCurrentSOID = function () {
    return this.cSOID
  }
}

splitPO.prototype.splitPOWrapper = function () {
  if (!this.poA) {
    // console.log('***No pos found****')
    nlapiLogExecution('DEBUG', 'No Purchase orders to Split', 'Returning....')
    return
  }
  var poA = this.poA
  if (!Array.isArray(poA)) {
    poA = [poA]
  }
  for (var i = 0; i < poA.length; i++) {
    var poId = poA[i]
    var newPOs = this.run(poId)
  }
  return newPOs
}

// var r = new splitPO(44076760)
// var r = new splitPO(44077322)
// r.splitPOWrapper()

var console = {
  log: function (m1) {
    nlapiLogExecution('DEBUG', '', m1)
  }
}
