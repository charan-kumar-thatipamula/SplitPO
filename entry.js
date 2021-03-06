/*
* Created on Fri Aug 11 2017
*
* Copyright (c) 2017  by Shashank Maddela
*
* The file Splits sales order based on Vendor and Shipping Service Level
*
*/

var srType = 'salesorder'
var sId = 'customsearch_ilt_so_search_po_split'
var sublist = 'item'
var poF = 'createdpo'

function run() {
  try {
    var qSO = getQualifiedSOs()
    for (var i = 0; i < qSO.length; i++) {
      var poIds = getPOIds(qSO[i])
      nlapiLogExecution('DEBUG', 'Start splitting Purchase orders for SO #: ' + qSO[i], 'POs: ' + JSON.stringify(poIds))
      var r = new splitPO(poIds)
      var newPOs = r.splitPOWrapper()
      nlapiLogExecution('DEBUG', 'newPOs for order #' + qSO[i], JSON.stringify(newPOs))
    }
  } catch (e) {
    nlapiLogExecution('ERROR', 'exception processing', e)
  }
}

function getQualifiedSOs() {
  nlapiLogExecution('DEBUG', 'Loading search', 'Search id: ' + sId)
  var searchresults = nlapiSearchRecord(srType, sId, null, null)
  var qSO = []
  for (var i = 0; searchresults != null && i < searchresults.length; i++) {
    var res = searchresults[i]
    qSO.push(res.getValue('internalid'))
  }
  nlapiLogExecution('DEBUG', 'Sales order returned', JSON.stringify(qSO))
  return qSO
}

function getPOIds(soId) {
  nlapiLogExecution('AUDIT', 'Getting POs for sales order', 'Sales order#: ' + soId)
  var r = nlapiLoadRecord(srType, soId)
  var lc = r.getLineItemCount(sublist)
  var poIds = []
  for (var i = 1; i <= lc; i++) {
    var isDrpshpItem = r.getLineItemValue('item', 'custcol_ilt_is_drpsp_item', i) || 'F'
    if (isDrpshpItem !== 'T') {
      continue
    }
    var poId = r.getLineItemValue(sublist, poF, i)
    if (poId && poIds.indexOf(parseInt(poId, 10)) === -1) {
      poIds.push(parseInt(poId, 10))
    }
  }
  nlapiLogExecution('AUDIT', 'Purchase orders on Sales order #: ' + soId, JSON.stringify(poIds))
  return poIds
}
