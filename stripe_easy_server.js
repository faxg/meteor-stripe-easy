// if there is not a secret key set
if (!Meteor.settings || !Meteor.settings.Stripe || !Meteor.settings.Stripe.secretKey) {
  console.warn("Stripe secret key is not set in Meteor.settings");
} else {
  var Stripe = Npm.require('stripe')(Meteor.settings.Stripe.secretKey);
}


// TEST WHETHER STRIPE IS DEFINED OR NOT
if (typeof Stripe === "undefined") {
  console.warn("Stripe is not defined");
}

// looks at known locations from account services to find the user email
// throws an error if not found, logs a warning if there are more than one
var detectMailFromServices = function(user) {
  var foundMails = {};

  if (user && user.services) {
    var services = user.services;

    foundMails.facebook = services.facebook ? services.facebook.email : null;
    foundMails.google = services.google ? services.google.email : null;
    foundMails.github = services.github ? services.github.email : null;
    // meetup
    // linkedin
    // ...
    foundMails.password = (user.emails && user.emails[0]) ? user.emails[0].address : null;


    var mails = _.toArray(_.compact(_.values(foundMails)));
    console.log('found mails', mails);
    if (mails[0]) {
      var email = mails[0];
      if (mails.lenght > 1) {
        console.warn('stripeEasy found more than one email, using ' + email + ' to authenticate with Stripe: ', foundMails);
      }
      return email;
    } else {
      console.log('No mail found for user id ' + user._id);
      throw new Meteor.Error(400, "stripeEasySubscribe Method was unable to find an email address for the signed in user");
    }
  } else {
    throw new Meteor.Error(400, "No services found on user object");
  }
}


Meteor.methods({
  /**
   * Creates the current meteor user as a stripe user and subscribes to a plan.
   * This must only be called for "new" stripe users, e.g. on first subscription.
   * Afterwards, the 'stripeEasyUpdate' method must be used.
   *
   **/
  stripeEasySubscribe: function(token, plan_id) {
    if (!this.userId) {
      throw new Meteor.Error(401, "No userId found by stripeEasySubscribe method");
    }

    var Future = Npm.require("fibers/future");
    var future = new Future();

    var user = Meteor.users.findOne({
      _id: this.userId
    });
    var services = user.services;
    var email = null;


    email = detectMailFromServices(user);


    var bound = Meteor.bindEnvironment(function(err, customer) {
      if (err) {
        console.warn(err);
        future.throw(new Meteor.Error(400, err.message));
      } else {
        // console.log(customer);
        // console.log(customer.id);
        // console.log("subscription data!!!!!");
        // console.log(customer.subscriptions.data[0]);
        // update the user object
        Meteor.users.update({
          _id: user._id
        }, {
          $set: {
            "stripe.customerId": customer.id,
            "stripe.subscription": customer.subscriptions.data[0]
          }
        });
        future.return(customer);
      }
    });

    //TODO maybe we should factor out user creation from subscribe
    Stripe.customers.create({
      card: token,
      plan: plan_id,
      email: email
    }, bound);

    return future.wait();
  }, // stripeEasySubscribe

  /**
   * Changes the plan for a user that has subscribed before (e.g. is a known user to
   * stripe and has a 'subscription' object).
   * Note that the user can have a canceled etc. subscription - it does not have to be 'active'.
   **/
  stripeEasyUpdate: function(plan_id) {
    if (!this.userId) {
      throw new Meteor.Error(401, "Not an authorized user.");
    }

    var Future = Npm.require("fibers/future");
    var future = new Future();
    var user = Meteor.users.findOne({
      _id: this.userId
    });

    var bound = Meteor.bindEnvironment(function(err, subscription) {
      if (err) {
        console.warn(err);
        future.throw(new Meteor.Error(400, err.message));
      } else {
        // console.log(subscription);
        Meteor.users.update({
          _id: user._id
        }, {
          $set: {
            "stripe.subscription": subscription
          }
        });
        future.return(subscription);
      }
    });

    Stripe.customers.updateSubscription(
      user.stripe.customerId,
      user.stripe.subscription.id, {
        plan: plan_id
      },
      bound
    );

    return future.wait();
  }, //stripeEasyUpdate

  /**
   * Cancels a currently active subscription
   *
   **/
  stripeEasyCancel: function() {
    if (!this.userId) {
      throw new Meteor.Error(401, "Not an authorized user.");
    }

    var Future = Npm.require("fibers/future");
    var future = new Future();
    var user = Meteor.users.findOne({
      _id: this.userId
    });

    var bound = Meteor.bindEnvironment(function(err, subscription) {
      if (err) {
        console.warn(err);
        future.throw(new Meteor.Error(400, err.message));
      } else {
        // console.log(subscription);
        Meteor.users.update({
          _id: user._id
        }, {
          $set: {
            "stripe.subscription": subscription
          }
        });
        future.return(subscription);
      }
    });

    Stripe.customers.cancelSubscription(
      user.stripe.customerId,
      user.stripe.subscription.id,
      bound
    );

    return future.wait();
  }, // stripeEasyCancel
});
