/**
 * Additional methods for Stripe integration
 **/
var Stripe = Npm.require('stripe')(Meteor.settings.Stripe.secretKey);

Meteor.methods({
  'stripeEasyListPlans': function(){},
  'stripeEasySubscriptionInfo': function(){},
  'stripeEasyCancelToNextPeriod': function(){},
  'stripeEasyGetBillingsStatements': function(){},
  'stripeEasyGetCurrentlyEffectivePlan': function(){},
});
