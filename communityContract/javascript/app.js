const express = require('express')
const app = express()

const FabricCAServices = require('fabric-ca-client');
const { FileSystemWallet, Gateway, X509WalletMixin } = require('fabric-network');

const fs = require('fs');
const path = require('path');

const ccpPath = path.resolve(__dirname, '..', '..', 'network', 'connection-org1.json');
const ccpJSON = fs.readFileSync(ccpPath, 'utf8');
const ccp = JSON.parse(ccpJSON);

app.use(function (req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', true);
  next();
});

app.use(express.json());

app.get('/:username/agreements', async (req, res) => {
  try {
    const walletPath = path.join(process.cwd(), 'wallet');
    const wallet = new FileSystemWallet(walletPath);
    const userExists = await wallet.exists(req.params.username);
    if (!userExists) {
      res.json({status: false, error: {message: 'User not exist in the wallet'}});
      return;
    }

    const gateway = new Gateway();
    await gateway.connect(ccpPath, { wallet, identity: req.params.username, discovery: { enabled: true, asLocalhost: true } });
    const network = await gateway.getNetwork('mychannel');
    const contract = network.getContract('CommunityContract');
    const result = await contract.evaluateTransaction('queryAllAgreements');
    res.json({status: true, agreements: JSON.parse(result.toString())});
  } catch (err) {
    res.json({status: false, error: err});
  }
});

app.post('/:username/createAgreement/:comId/:cost/:most', async (req, res) => {

  try {
    const walletPath = path.join(process.cwd(), 'wallet');
    const wallet = new FileSystemWallet(walletPath);
    const userExists = await wallet.exists(req.params.username);
    if (!userExists) {
      res.json({status: false, error: {message: 'User not exist in the wallet'}});
      return;
    }

    const gateway = new Gateway();
    await gateway.connect(ccpPath, { wallet, identity: req.params.username, discovery: { enabled: true, asLocalhost: true } });
    const network = await gateway.getNetwork('mychannel');
    const contract = network.getContract('CommunityContract');
    const s = await contract.submitTransaction('createAgreement', req.params.comId, req.params.cost, req.params.most);
    res.json({status: true, message: 'Transaction (create agreement) has been submitted.', ledgerId: JSON.parse(s.toString())})
  } catch (err) {
    res.json({status: false, error: err});
  }
});

app.post('/registerUser/:username', async (req, res) => {

  try {

    // Create a new file system based wallet for managing identities.
    const walletPath = path.join(process.cwd(), 'wallet');
    const wallet = new FileSystemWallet(walletPath);
    console.log(`Wallet path: ${walletPath}`);

    // Check to see if we've already enrolled the user.
    const userExists = await wallet.exists(req.params.username);
    if (userExists) {
        res.json({status: false, error: {message: 'An identity for the user "' + req.params.username +'" already exists in the wallet'}});
        return;
    }

    // Check to see if we've already enrolled the admin user.
    const adminExists = await wallet.exists('admin');
    if (!adminExists) {
        res.json({status: false, error: {message: 'An identity for the admin user "admin" does not exist in the wallet'}});
        return;
    }

    // Create a new gateway for connecting to our peer node.
    const gateway = new Gateway();
    await gateway.connect(ccpPath, { wallet, identity: 'admin', discovery: { enabled: true, asLocalhost: true } });

    // Get the CA client object from the gateway for interacting with the CA.
    const ca = gateway.getClient().getCertificateAuthority();
    const adminIdentity = gateway.getCurrentIdentity();

    // Register the user, enroll the user, and import the new identity into the wallet.
    const secret = await ca.register({ affiliation: 'org1.department1', enrollmentID: req.params.username, role: 'client' }, adminIdentity);
    const enrollment = await ca.enroll({ enrollmentID: req.params.username, enrollmentSecret: secret });
    const userIdentity = X509WalletMixin.createIdentity('Org1MSP', enrollment.certificate, enrollment.key.toBytes());
    await wallet.import(req.params.username, userIdentity);
    res.json({status: true, succesfull: {message: 'Successfully registered and enrolled admin user "' + req.params.username + '" and imported it into the wallet'}});
    return;

    } catch (error) {
        res.json({status: false, error: {message: `Failed to register user: ${error}`}});
        return;
    }
});

app.post('/registerAdmin', async (req, res) => {

  try {

    // Create a new CA client for interacting with the CA.
    const caInfo = ccp.certificateAuthorities['ca.org1.example.com'];
    const caTLSCACerts = caInfo.tlsCACerts.pem;
    const ca = new FabricCAServices(caInfo.url, { trustedRoots: caTLSCACerts, verify: false }, caInfo.caName);

    // Create a new file system based wallet for managing identities.
    const walletPath = path.join(process.cwd(), 'wallet');
    const wallet = new FileSystemWallet(walletPath);
    console.log(`Wallet path: ${walletPath}`);

    // Check to see if we've already enrolled the admin user.
    const adminExists = await wallet.exists('admin');
    if (adminExists) {
        res.json({status: false, error: {message: 'An identity for the admin user "admin" already exists in the wallet'}});
        return;
    }

    // Enroll the admin user, and import the new identity into the wallet.
    const enrollment = await ca.enroll({ enrollmentID: 'admin', enrollmentSecret: 'adminpw' });
    const identity = X509WalletMixin.createIdentity('Org1MSP', enrollment.certificate, enrollment.key.toBytes());
    await wallet.import('admin', identity);
    res.json({status: true, Success: {message: 'Successfully enrolled admin user "admin" and imported it into the wallet'}});

    } catch (error) {
        res.json({status: false, error: {message: `Failed to enroll admin user "admin": ${error}`}});
        process.exit(1);
    }
});

app.put('/:username/voteAgreement/:contractId', async (req, res) => {

  try {
    const walletPath = path.join(process.cwd(), 'wallet');
    const wallet = new FileSystemWallet(walletPath);
    const userExists = await wallet.exists(req.params.username);
    if (!userExists) {
      res.json({status: false, error: {message: 'User not exist in the wallet'}});
      return;
    }

    const gateway = new Gateway();
    await gateway.connect(ccpPath, { wallet, identity: req.params.username, discovery: { enabled: true, asLocalhost: true } });
    const network = await gateway.getNetwork('mychannel');
    const contract = network.getContract('CommunityContract');
    await contract.submitTransaction('voteAgreement', req.params.contractId);
    res.json({status: true, message: 'Transaction (Vote Agreement) has been submitted.'})
  } catch (err) {
    res.json({status: false, error: err});
  }
});

app.put('/:username/nayAgreement/:contractId', async (req, res) => {

  try {
    const walletPath = path.join(process.cwd(), 'wallet');
    const wallet = new FileSystemWallet(walletPath);
    const userExists = await wallet.exists(req.params.username);
    if (!userExists) {
      res.json({status: false, error: {message: 'User not exist in the wallet'}});
      return;
    }

    const gateway = new Gateway();
    await gateway.connect(ccpPath, { wallet, identity: req.params.username, discovery: { enabled: true, asLocalhost: true } });
    const network = await gateway.getNetwork('mychannel');
    const contract = network.getContract('CommunityContract');
    await contract.submitTransaction('nayAgreement', req.params.contractId);
    res.json({status: true, message: 'Transaction (Nay Agreement) has been submitted.'})
  } catch (err) {
    res.json({status: false, error: err});
  }
});

app.listen(4000, () => {
  console.log('REST Server listening on port 4000');
});