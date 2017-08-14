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
  var sslF = 'custcol_ilt_ship_service_level'
  var that = this
  var fieldsToWorkWith = ['item', 'custcol_vendor', 'quantity', 'rate', 'amount', 'createdpo', 'custcol_ilt_ship_service_level', 'custcol_ilt_is_drpsp_item', 'custcol_ilt_shipping_profile', 'custcol_ilt_dont_ship_before', 'custcol_ilt_dont_ship_after', 'custcol_lum_ven_must_ship']
  var fieldsToSkip = []
  var srType = 'salesorder'
  var dnsBfrF = 'custcol_ilt_dont_ship_before'
  var dnsAftrF = 'custcol_ilt_dont_ship_after'
  var msByF = 'custcol_lum_ven_must_ship'
  var doneF = 'custbody_ilt_po_split_done'
  function loadPO(poId) {
    nlapiLogExecution('AUDIT', 'Loading PO', 'PO #: ' + poId)
    var r = nlapiLoadRecord(that.rType, poId)
    var lc = r.getLineItemCount(that.sublist)
    var record = []
    for (var i = 1; i <= lc; i++) {
      var line = {}
      for (var fInd = 0; fInd < fieldsToWorkWith.length; fInd++) {
        var f = fieldsToWorkWith[fInd]
        var v = r.getLineItemValue(that.sublist, f, i)
        if (f === sslF) {
          line[f] = [r.getLineItemValue(that.sublist, f + '_display', i), v] // ['3 Day Select', '16'] Id for same ssl can be diff. based on shipping profile
        } else {
          line[f] = v
        }
      }
      record.push(line)
    }

    nlapiLogExecution('AUDIT', 'PO loaded PO #: ' + poId, JSON.stringify(record))
    return record
  }

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
    var r = nlapiLoadRecord(that.rType, that.getCurrentPOID())
    that.setCurrenSOID(r.getFieldValue('createdfrom'))
    for (var ssl in linesBasedOnSSL) {
      if (linesBasedOnSSL.hasOwnProperty(ssl)) {
        nlapiLogExecution('DEBUG', 'Start PO creation', 'Creating PO for Shipping Service Level: ' + ssl)
        var tr = nlapiCopyRecord(that.rType, that.getCurrentPOID())
        var rId = generateRecord(tr, linesBasedOnSSL[ssl], ssl)
        nlapiLogExecution('AUDIT', 'PO Created for ssl: ' + ssl, 'PO #: ' + rId)
        createdPOs[r.getFieldValue('entity') + '|' + ssl] = rId
      }
    }
    nlapiLogExecution('DEBUG', 'createdPOs: ', JSON.stringify(createdPOs))
    for (var i = 1; i <= r.getLineItemCount(that.sublist); i++) {
      r.setLineItemValue(that.sublist, 'isclosed', i, 'T')
    }
    nlapiSubmitRecord(r)
    nlapiLogExecution('AUDIT', 'Closed all line items of PO: ' + that.getCurrentPOID())
    return createdPOs
  }

  function generateRecord(r, lines, ssl) {
    var lc = r.getLineItemCount(that.sublist)
    for (var i = 1; i <= lc; i++) {
      r.removeLineItem(that.sublist, 1)
    }

    var dnsBfr = ''
    var dnsAftr = ''
    var msBy = ''
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i]
      for (var fld in line) {
        if (line.hasOwnProperty(fld) && fieldsToSkip.indexOf(fld) === -1) {
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
    } // end of 'lines' for loop

    nlapiLogExecution('DEBUG', 'dnsBfr, dnsAftr, msBy', dnsBfr + ', ' + dnsAftr + ', ' + msBy)
    r.setFieldValue('shipdate', dnsBfr)
    r.setFieldValue('custbody_ilt_dont_ship_after', dnsAftr)
    r.setFieldValue('custbody_ilt_must_ship_by', msBy)

    nlapiLogExecution('DEBUG', 'shipmethod', ssl) // sslMap[ssl])
    r.setFieldText('shipmethod', ssl) // sslMap[ssl])
    var rId =  nlapiSubmitRecord(r)

    return rId
  }

  function getMin(dStr, fld, line) {
    if (!dStr || !dStr.length) {
      return line[fld]
    }
    dStr = new Date(dStr) < new Date(line[fld]) ? dStr : line[fld]
    return dStr
  }

  function updateSO(soId, newPOs) {
    nlapiLogExecution('AUDIT', 'Updating the sales order with PO numbers', 'Sales order #:' + soId)
    var r = nlapiLoadRecord(srType, soId)
    for (var i = 1; i <= r.getLineItemCount(that.sublist); i++) {
      var isDrpshpItem = r.getLineItemValue(that.sublist, 'custcol_ilt_is_drpsp_item', i) || 'F'
      if (isDrpshpItem !== 'T') {
        continue
      }
      var poId = that.getCurrentPOID()
      if (newPOs && typeof newPOs === 'object') {
        var key = r.getLineItemValue(that.sublist, 'custcol_ilt_vendor_name', i) + '|' + r.getLineItemValue(that.sublist, sslF + '_display', i)
        poId = newPOs[key]
      }
      nlapiLogExecution('DEBUG', 'Updating line', 'line Number: ' + i + 'PO Id: ' + poId)
      r.setLineItemValue(that.sublist, that.poF, i, poId)
    }
    r.setFieldValue(doneF, 'T')
    nlapiSubmitRecord(r)
    nlapiLogExecution('AUDIT', 'Updated line items with PO numbers', 'SO #' + soId)
  }

  function isSplitRequired(lines) {
    var count = 0
    for (var k in lines) {
      if (lines.hasOwnProperty(k)) {
        count++
      }
      if (count > 1) {
        nlapiLogExecution('DEBUG', 'Split eligibility', 'split required. Multiple shipping service levels found')
        return true
      }
    }
    nlapiLogExecution('DEBUG', 'Split eligibility', 'split not required. There is only one Shipping service level across all line items.')
    return false
  }

  this.run = function (poId) {
    try {
      nlapiLogExecution('DEBUG', 'Current Purchase order Id: ', poId)
      poId = parseInt(poId, 10)
      this.setCurrentPOID(poId)
      var lines = loadPO(poId)
      var newPOs = ''
      if (isSplitRequired(lines)) {
        var linesBasedOnSSL = combineBySSL(lines)
        newPOs = createPOBasedOnSSL(linesBasedOnSSL)
      }
      updateSO(this.getCurrentSOID(), newPOs)
      return newPOs
    } catch (e) {
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
