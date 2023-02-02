import Stripe from 'stripe'
import moment from "moment"
import AWS from 'aws-sdk'

const START_TIME = 1675242000
const END_TIME = 1675252800

const dynamoDb = new AWS.DynamoDB.DocumentClient({
  region: 'us-west-2'
})
const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2022-11-15',
})

const loadTransactions = async () => {
  const params = {
    TableName: 'prod-connect-account-transfer-TransferResults'
  }

  let items
  const transactions = []
  do {
    try {
      items = await dynamoDb.scan(params).promise()
      if (items && items.Items) {
        transactions.push(...items.Items)
      }
      params.ExclusiveStartKey  = items.LastEvaluatedKey 
    } catch (error) {
      console.log('scanning error - ', error)
      return []
    }
  } while (items.LastEvaluatedKey)

  return transactions
}

const retrieveTransfers = async (accountId) => {
  try {
    const transfers = await stripe.transfers.list({
      destination: 'acct_1CGsXZAEOM60IWnV',
      limit: 10
    }, {
      stripeAccount: accountId
    })

    const filtered = transfers.data.filter(transfer => transfer.created > START_TIME && transfer.created < END_TIME)

    if (filtered.length > 3 || filtered.length !== transfers.data.length) {
      console.log('************ ALERT - ', accountId, filtered)
    } else {
      console.log('Normal transfers - ', accountId, filtered)
    }

    return filtered
  } catch (error) {
    console.log('retrieving transfer error - ', error)
    return []
  }
}

const reverseTransfer = async (accountId, transfer) => {
  try {
    const reverse = await stripe.transfers.createReversal(transfer.id, {
      stripeAccount: accountId
    })
    console.log('reverse - ', reverse)
  } catch (error) {
    console.log('reverse transfer error - ', error)
  }
}

const checkBalance = async (accountId) => {
  try {
    const balance = await stripe.balance.retrieve({
      stripeAccount: accountId
    })
    console.log('balance - ', balance)
  } catch (error) {
    console.log('loading balance error - ', error)
  }
}

const reverse = async () => {
  const transactions = await loadTransactions()
  console.log('finished loading transactions - ', transactions.length)
  
  const limit = transactions.length;
  // const limit = 3;
  for (let i = 0; i < limit; i += 1) {
    await checkBalance(transactions[i].accountId)
    if (transactions[i].success === 1) {
      // const transfers = await retrieveTransfers(transactions[i].accountId)
      // console.log('*********** Checking before balance')
      await checkBalance(transactions[i].accountId)
      // for (let j = 0; j < transfers.length; j += 1) {
      //   await reverseTransfer(transactions[i].accountId, transfers[j])
      // }
      // console.log('*********** Checking after balance')
      // await checkBalance(transactions[i].accountId)
    }
  }

}

(async () => {
  try {
    await reverse()
  } catch (e) {
    console.log('error - ', e)
  }
})()