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
var fieldsToWorkWith = ['item', 'custcol_vendor', 'quantity', 'rate', 'amount', 'createdpo', 'custcol_ilt_ship_service_level', 'custcol_ilt_is_drpsp_item']
var fieldsToSkip = []

function run() {
  try {

  } catch (e) {
    nlapiLogExecution('DEBUG', 'exception processing', e)
  }
  var qSO = getQualifiedSOs()
  nlapiLogExecution('DEBUG', 'qualified salesorders', JSON.stringify(qSO))
  for (var i in qSO) {
    var poIds = getPOIds(qSO[i])
    var r = new splitPO(poIds)
    var newPOs = r.splitPOWrapper()
    nlapiLogExecution('DEBUG', 'newPOs for order #' + qSO[i], JSON.stringify(newPOs))
  }
}

function getQualifiedSOs() {
  var searchresults = nlapiSearchRecord(srType, sId, null, null)
  var qSO = []
  for (var i = 0; searchresults != null && i < searchresults.length; i++) {
    var res = searchresults[i]
    qSO.push(res.getValue('internalid'))
  }
}

function getPOIds(soId) {
  var r = nlapiLoadRecord(srType, soId)
  var lc = r.getLineItemCount(sublist)
  var poIds = []
  for (var i = 1; i <= lc; i++) {
    poIds.push(r.getLineItemValue(sublist, i, poF))
  }
  return poIds
}
