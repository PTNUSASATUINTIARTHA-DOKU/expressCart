const express = require('express');
const { indexOrders } = require('../indexing');
const numeral = require('numeral');
const { getId, sendEmail, getEmailTemplate } = require('../common');
const { getPaymentConfig } = require('../config');
const { emptyCart } = require('../cart');
const router = express.Router();

function sha1(str) {
    //  discuss at: http://phpjs.org/functions/sha1/
    // original by: Webtoolkit.info (http://www.webtoolkit.info/)
    // improved by: Michael White (http://getsprink.com)
    // improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
    //    input by: Brett Zamir (http://brett-zamir.me)
    //  depends on: utf8_encode
    //   example 1: sha1('Kevin van Zonneveld');
    //   returns 1: '54916d2e62f65b3afa6e192e6a601cdbe5cb5897'
  
    var rotate_left = function(n, s) {
      var t4 = (n << s) | (n >>> (32 - s));
      return t4;
    };
  
    /*var lsb_hex = function (val) { // Not in use; needed?
      var str="";
      var i;
      var vh;
      var vl;
  
      for ( i=0; i<=6; i+=2 ) {
        vh = (val>>>(i*4+4))&0x0f;
        vl = (val>>>(i*4))&0x0f;
        str += vh.toString(16) + vl.toString(16);
      }
      return str;
    };*/
  
    var cvt_hex = function(val) {
      var str = '';
      var i;
      var v;
  
      for (i = 7; i >= 0; i--) {
        v = (val >>> (i * 4)) & 0x0f;
        str += v.toString(16);
      }
      return str;
    };
  
    var blockstart;
    var i, j;
    var W = new Array(80);
    var H0 = 0x67452301;
    var H1 = 0xEFCDAB89;
    var H2 = 0x98BADCFE;
    var H3 = 0x10325476;
    var H4 = 0xC3D2E1F0;
    var A, B, C, D, E;
    var temp;
  
    str = unescape(encodeURIComponent(str))
    var str_len = str.length;
  
    var word_array = [];
    for (i = 0; i < str_len - 3; i += 4) {
      j = str.charCodeAt(i) << 24 | str.charCodeAt(i + 1) << 16 | str.charCodeAt(i + 2) << 8 | str.charCodeAt(i + 3);
      word_array.push(j);
    }
  
    switch (str_len % 4) {
      case 0:
        i = 0x080000000;
        break;
      case 1:
        i = str.charCodeAt(str_len - 1) << 24 | 0x0800000;
        break;
      case 2:
        i = str.charCodeAt(str_len - 2) << 24 | str.charCodeAt(str_len - 1) << 16 | 0x08000;
        break;
      case 3:
        i = str.charCodeAt(str_len - 3) << 24 | str.charCodeAt(str_len - 2) << 16 | str.charCodeAt(str_len - 1) <<
          8 | 0x80;
        break;
    }
  
    word_array.push(i);
  
    while ((word_array.length % 16) != 14) {
      word_array.push(0);
    }
  
    word_array.push(str_len >>> 29);
    word_array.push((str_len << 3) & 0x0ffffffff);
  
    for (blockstart = 0; blockstart < word_array.length; blockstart += 16) {
      for (i = 0; i < 16; i++) {
        W[i] = word_array[blockstart + i];
      }
      for (i = 16; i <= 79; i++) {
        W[i] = rotate_left(W[i - 3] ^ W[i - 8] ^ W[i - 14] ^ W[i - 16], 1);
      }
  
      A = H0;
      B = H1;
      C = H2;
      D = H3;
      E = H4;
  
      for (i = 0; i <= 19; i++) {
        temp = (rotate_left(A, 5) + ((B & C) | (~B & D)) + E + W[i] + 0x5A827999) & 0x0ffffffff;
        E = D;
        D = C;
        C = rotate_left(B, 30);
        B = A;
        A = temp;
      }
  
      for (i = 20; i <= 39; i++) {
        temp = (rotate_left(A, 5) + (B ^ C ^ D) + E + W[i] + 0x6ED9EBA1) & 0x0ffffffff;
        E = D;
        D = C;
        C = rotate_left(B, 30);
        B = A;
        A = temp;
      }
  
      for (i = 40; i <= 59; i++) {
        temp = (rotate_left(A, 5) + ((B & C) | (B & D) | (C & D)) + E + W[i] + 0x8F1BBCDC) & 0x0ffffffff;
        E = D;
        D = C;
        C = rotate_left(B, 30);
        B = A;
        A = temp;
      }
  
      for (i = 60; i <= 79; i++) {
        temp = (rotate_left(A, 5) + (B ^ C ^ D) + E + W[i] + 0xCA62C1D6) & 0x0ffffffff;
        E = D;
        D = C;
        C = rotate_left(B, 30);
        B = A;
        A = temp;
      }
  
      H0 = (H0 + A) & 0x0ffffffff;
      H1 = (H1 + B) & 0x0ffffffff;
      H2 = (H2 + C) & 0x0ffffffff;
      H3 = (H3 + D) & 0x0ffffffff;
      H4 = (H4 + E) & 0x0ffffffff;
    }
  
    temp = cvt_hex(H0) + cvt_hex(H1) + cvt_hex(H2) + cvt_hex(H3) + cvt_hex(H4);
    return temp.toLowerCase();
  }

router.post('/generate', async (req, res, next) => {
    const dokuConfig = getPaymentConfig('doku');
    const db = req.app.db;

    var d = new Date();
    var n = d.toISOString().replace(/-/g,'').replace(/:/g,'').replace(/T/g,'').slice(0,14);


    var sharedKey = dokuConfig.sharedKey;
    var mallId = dokuConfig.mallId;
    var currencyNum = dokuConfig.currencyNum;
    if (currencyNum == '360') currencyNum = '';

    var amount = numeral(req.session.totalCartAmount).format('0.00');
    var basket = 'Item,' + amount + ',1,' + amount;

    const orderDoc = {
        orderPaymentGateway: 'DOKU',
        orderPaymentMessage: 'Your payment is waiting to be completed',
        orderTotal: amount,
        orderCurrencyNum: currencyNum,
        orderMallId: mallId,
        orderShipping: req.session.totalCartShipping,
        orderItemCount: req.session.totalCartItems,
        orderProductCount: req.session.totalCartProducts,
        orderCustomer: getId(req.session.customerId),
        orderEmail: req.session.customerEmail,
        orderCompany: req.session.customerCompany,
        orderFirstname: req.session.customerFirstname,
        orderLastname: req.session.customerLastname,
        orderAddr1: req.session.customerAddress1,
        orderAddr2: req.session.customerAddress2,
        orderCountry: req.session.customerCountry,
        orderState: req.session.customerState,
        orderPostcode: req.session.customerPostcode,
        orderPhoneNumber: req.session.customerPhone,
        orderComment: req.session.orderComment,
        orderStatus: 'Pending',
        orderDate: d,
        orderProducts: req.session.cart,
        orderType: 'Single',

    };

    try{
        const newDoc = await db.orders.insertOne(orderDoc);
        // get the new ID
        const orderId = newDoc.insertedId;
        var words = sha1(amount + mallId + sharedKey + orderId + currencyNum);

        res.status(200).json({
            'transIdMerchant': orderId,
            'words': words,
            'requestDateTime': n,
            'sessionId': orderId,
            'amount': amount,
            'basket': basket,
        });

    } catch (ex) {
        res.status(500).json({ err: 'Your order failed. Please try again.' });
    }    

});

router.post('/notify', async (req, res, next) => {

    const config = req.app.config;
    const dokuConfig = getPaymentConfig('doku');
    const db = req.app.db;

    var sharedKey = dokuConfig.sharedKey;
    var mallId = dokuConfig.mallId;
    var currencyNum = dokuConfig.currencyNum;
    if (currencyNum == '360') currencyNum = '';

    if (!req.body || !req.body.TRANSIDMERCHANT || !req.body.AMOUNT || !req.body.WORDS || !req.body.RESULTMSG || !req.body.VERIFYSTATUS) {
        res.status(200).send('STOP-InsufficientParam');
    } else {
        var words = sha1(req.body.AMOUNT + mallId + sharedKey + req.body.TRANSIDMERCHANT + req.body.RESULTMSG + req.body.VERIFYSTATUS + currencyNum);
        console.log(words);
        console.log(req.body.WORDS);
        if (req.body.WORDS != words) {
            res.status(200).send('STOP-InvalidWords');
        } else {
            const order = await db.orders.findOne({ _id: getId(req.body.TRANSIDMERCHANT) });
            if (!order) {
                res.status(200).send('STOP-InvoiceNotFound');
            } else {
                if (req.body.AMOUNT !== order.orderTotal) {
                    res.status(200).send('STOP-InvalidAmount');
                } else {
                    try {
                        await db.orders.updateOne({
                            _id: order._id },
                            { $set: { 
                                orderStatus: 'Paid',
                                paymentStatus: req.body.RESULTMSG,
                                paymentResponseCode: req.body.RESPONSECODE,
                                paymentApprovalCode: req.body.APPROVALCODE,
                                paymentChannel: req.body.PAYMENTCHANNEL,
                                paymentBank: req.body.BANK,
                                paymentCardNumber: req.body.MCN,
                                paymentDate: req.body.PAYMENTDATETIME,
                                paymentVerifyId: req.body.VERIFYID,
                                paymentVerifyScore: req.body.VERIFYSCORE,
                                paymentVerifyStatus: req.body.VERIFYSTATUS,
                                paymentBrand: req.body.BRAND,
                                paymentCardHolderName: req.body.CHNAME,
                                payment3DSStatus: req.body.THREEDSECURESTATUS,
                                paymentLiability: req.body.LIABILITY,
                                paymentEduStatus: req.body.EDUSTATUS
                            }
                        }, { multi: false });            
    
                    } catch (ex) {
                        console.error('Error updating status database ', ex);
                        res.status(200).send('STOP-FailedUpdateDB');
                    }

                    try {
                        if (req.body.RESULTMSG === 'SUCCESS') {
                            if(req.session.cart){
                                emptyCart(req, res, 'function');
                            }
                            const paymentResults = {
                                message: 'Your payment was successfully completed',
                                messageType: 'success',
                                paymentEmailAddr: order.orderEmail,
                                paymentApproved: true,
                                paymentDetails: `<p><strong>Order ID: </strong>${order._id}</p><p><strong>Approval Code: </strong>${order.paymentApprovalCode}</p>`
                            };
                            sendEmail(req.session.paymentEmailAddr, `Your payment with ${config.cartTitle}`, getEmailTemplate(paymentResults));
                        }
                        res.status(200).send('CONTINUE');        
                    } catch (ex) {
                        console.error('Error sending email ', ex);
                    }
                }
            }
        }
    }
});

module.exports = router;
