// const crypto = require("crypto");
const https = require('https');
const crypto = require("crypto-js");
const bcrypt = require("bcrypt");
const BigInteger = require("bigi");
const ecurve = require("ecurve");
const ecparams = ecurve.getCurveByName("secp256k1"); //ecurve library constructor
const secrets = require("secrets.js-grempe");
const kyber = require("crystals-kyber");
const ethers = require('ethers');

// Functions
function hash(message) {
  const rounds = 12;
  const salt = `$2b$${rounds}$`.concat(
    crypto.SHA512(message).toString(crypto.enc.Hex)
  );
  const hashBcrypt = bcrypt.hashSync(message, salt);
  return crypto.SHA256(hashBcrypt).toString(crypto.enc.Hex);
}

function hexTOdec(hex) {
  return String(parseInt(hex, 16).toString(10));
}

async function fetchRandomBytes() {
  return new Promise((resolve, reject) => {
    https.get('https://www.random.org/cgi-bin/randbyte?nbytes=32&format=h', (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve(data.trim());
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

async function random32() {
  const response = await fetchRandomBytes();
  return response;
}

function hashToEllipticCurvePoint(hv) {
  const hashValue = BigInteger(String(hv));
  const bufferHashValue = Buffer.from(hash(String(hv)), "hex");
  const ecPoint = ecparams.pointFromX(true, hashValue);
  while (ecparams.isOnCurve(ecPoint) == false) {
    bufferHashValue = Buffer.from(hash(Buffer.toString()), "hex");
    ecPoint = ecparams.pointFromX(true, BigInteger.fromBuffer(bufferHashValue));
  }
  return String(ecPoint.affineX);
}

function ecPointExponentiation(sp, exp) {
  const startPoint = BigInteger(String(sp));
  const exponent = BigInteger(String(exp));
  const ecPoint = ecparams.pointFromX(true, startPoint);
  const resultPoint = ecPoint.multiply(exponent);
  return String(resultPoint.affineX);
}

function ecInverse(Cr) {
  const key = BigInteger(String(Cr));
  const keyInv = key.modInverse(ecparams.n);
  return keyInv.toString();
}

function secretToUint8Array(secret) {
  const secretUint8Array = new Uint8Array(Math.ceil(secret.length / 2));
  for (let i = 0; i < secret.length; i++) {
    secretUint8Array[i] = parseInt(secret.substr(i * 2, 2), 16);
  }
  return secretUint8Array;
}

function uint8ArrayToHex(uint8Array) {
  const hex = Buffer.from(uint8Array).toString("hex");
  return hex;
}

// Make changes to the original function (dir: node_modules\crystals-kyber\kyber1024.js)
// https://www.diffchecker.com/eG5d9gLb/
function kyberKeyGeneration(secretUint8Array) {
  const pk_sk = kyber.KeyGen512(secretUint8Array);
  return [uint8ArrayToHex(pk_sk[0]), uint8ArrayToHex(pk_sk[1])];
}

// Client side
const username = "yathin017";
const pwd1 = "Password1";
const pwd2 = "Password2";

const hashUsername = hash(username);
console.log("USERNAME: ",hashUsername);

const Cr = random32();
const CrInv = ecInverse(Cr);
const alpha = ecPointExponentiation(
  hashToEllipticCurvePoint(hexTOdec(username.concat(pwd1))),
  Cr
);

console.log("ALPHA: ",alpha);

// Server side
const Sr = "fb c2 d4 7d 1e 80 03 c9 84 82 0b 81 f5 16 5a f3 e0 1c 23 1a af 02 76 49 0c cb 63 17 32 1f 6b b6"; // random32()
const beta = ecPointExponentiation(alpha, Sr);

// Client side
const gamma = secretToUint8Array(ecPointExponentiation(beta, CrInv));
const hashPwd2 = hash(pwd2);

const keyPair = kyberKeyGeneration(gamma);

// (n>=2, m>=5) Shamir's Secret Sharing
const shares = [
  String("801").concat(String(hashPwd2)),
  String("802").concat(String(keyPair[1])),
];

const share1 = secrets.newShare("3", shares);
console.log("SHARE 1: " + share1);

const share2 = secrets.newShare("4", shares);
console.log("SHARE 2: " + share2);

const mainshare = secrets.newShare("5", shares);
console.log("MAIN SHARE 3: " + mainshare);

const secret = secrets.combine(shares);
console.log("SECRET: " + secret);

const wallet = new ethers.Wallet(hash(secret));
console.log("PRIVATE KEY: ",wallet.privateKey);
console.log("ADDRESS: ",wallet.address);

// Output
// USERNAME:  454eb3c446ba958ad7286dda54b35714cd33866c0a2fd7b1463b675a39d1b49c
// ALPHA:  18128813444111859610654156859142599451187222915387009565638848207466573458422
// SHARE 1: 803b16500cc9803adbe1998453b99d885e07a3c34d0f48b225cb138a94a11e73f4dd6f74618710efa17728d63b200055275b32ff5b6ab81d6fe867a83f9c582d6fb65f5d6597e0a57d407ded56f7cb9a6e232a3a0e9e26d2d1e4c839f6f5e8744d37cf38af0038c2fed99bc10a1838256072d06ff20de024ec37012e442a40afaf21a764002f7bc9941781828780db7f3029c67779471c41e870c30d0d4d2c3bff049f8fd3e934560ab24ce842cb83dfd2b1f3c46cba57a9b67f871d1293aa6307c0f3ac63b8b1889958ddbd91010577ce6f97a213bee813c20683085c1e900e7dc2bdd13891c2b97f5032e14118c05bbd439452c8c2d84110dcc20c0ebced7eb0f8e86aa657e85002f1b8efa824b03565535bac620a81730d82b1c9804c2b0ed73346ecbb124386fe2c7074085ceee0bb4c25af1ba54a3751068221aff97f06d86dd6f6b5453dc76dae9fc1646dd2b2c2fad3b66c9f282a805c38fb77259982012208a91deeba6f18fa0a5886ac2d7ec332294cf0835b93b6d972c1b3b97d5f0bd8366058a47d3ce58193a040296898408c870886e2cb7824c2be5a91eb81f67a2d22ac0a7467544bb70fbd5d032d34ef421663c628f305b29e1309848e3af561042392f241c643a7822b266595a9dfe89a74d623a2088e693240482daeb1400f1dc6fe8deb5e1cfc9c65eb3293ba0d0542bd4877a3d8da346916fbfa95980d94018dce06eca325671a073d8867f757e5ee8f784649bef7f2d25664417af44702fadd53168dc2dc6cd3d79a79f323f511c93ee88e5ef80827d1b420c95466b12e62c9be962af7e90ba11212750f111f638fcd10d2537b6623f0953fb986884d4b77e3b26c7844c750dcdbd6eefd87367d228e066b162912c250dd0e2f6d4fade1543feb1eed711d82a5b60f6b4b9f0c9d8019ac925ea79f763e9fc42d5044b9e64b6e9ed2ec44695ce30ef9750119ef6408887b0451fc10f207be22109e0d604373bb1fb8ce51b89b6a38450128e5c0e22c555ff823b26b39921a4d7886d2022b7ae359f13b9e65bb3363e84326d8702b0de24f33a6cda403ceed74d9797a2cfa53d2080b3ce80be7aa3a4ba1fecc52a2d652b805eaf40475a492b06ffb5c876f285bbe8a1813517d4c90e3c7ad775001d0fe0fd8fc00b0cadcb722c3015b9c158b2e5353a1a39260ae59122f9d96cbc9207e5d116c470ca931e7a68357d46eda345d10df22f627f066ce509e8add76661641121551c0837df4800227d320143f0dd71c5c82bbc703b517e094f3151134c1927b378bcabd9e6eed61332e9e3feba1ccbd302402750afbffe75470b133417028d85fff629bd9aa468977bdf1204a70d1ef982ba093bde4c8f42b5996f3f8ac37d65d86077fc0b10325e5357ded96ccfa2b9094be57bac8329a4b11cc8920018bcbb445cea15e0d980f7af595c13c447c2aca6de52add28a0c144b29b3f48b3edd5182cd03da01405a269c1916b33bd0486696eb3e499134be30812d9bd23a25cd956d0551e6c674c829840248a1ec788b53e90ae4719e75d4ddf51fb077e342135cff082da2023b460fe8d64db19537353ca9737bc33cd469e42b70efb06edacd327c9c97ab0f8f031cd010b27720cc9a06f6ecd0db4df8d8a4073775d9a249d9921bdce7c550a922ee63dbb121a0052dbb05aa559f75eb8ada23808ec80c899c8b117ac07df9e9125822e7938c498e70ffb797bf5e11718e32fc990cb95a216fe0a513200e94a71fcad176d933299712275fa8da24cdf08215fddbf837ed8797e5f58a478658eb55fa6f7ee05a75b9f619520490f50f0cbd42371d27930b0fc808f0fc140fa376ea272575e6ec6c5ac886205439d710210bec89ba8af6ce3d841876202d70885b86e80b9f5b05f096064eac70c616821ea755ee1e534c663e29e89e2929e3747ee2b31800fffc52334622daaa934605c615c69722cba03b874c30aa58f31249e1be0cb76f50024c758a37d3850e052e7d8c8d41a6b9f335bd5407c9069a52e2d9ecc1e4a1f6fb9586e9c47244d518571bbbcef106d27f75496aeab1d86ddc0ce38c763b0f325ac080b2bab56c6ff05b4c60a91025963c8468fcd5f64cc7027a16d5ec3e9f6252676ba5d30cc6f67ce8dc73d96e69a928a8b9b2f8a51e4f3e5b953f826600ca659f96f7a1236b43fcbf62c003d620b0d715d4234fd2f8043303086e3ce122a59c6b834377264460141f7d141169e0d0fc7f9c686fe3b5428f18d51c5c3e97e1814fb63ee38e58457910e65378b58ccbd84b0fe67b5efbf85ebcd78ea5435917a3f9
// SHARE 2: 804a97600e361899f3eb06126e5edc1dbadc96672d58fc05596a96c95b1a42eef32da06af3c541b94abddcf792000868d5eacc7032a90d1da9e52c9d41d7b58da187603da10c3110bdf83ce5367c6bd02a87d840d35a862c233bed4e26793deaa5cc60c4c858943c73fed3b2881d4588783c20f1250ce05bb74d82da7a50711948039d7a005063bed2ccc3c44cc92a60c056b735b7f54f733de1e78d5dfd074b28538911763fc26f0905ae6574e31ea17cdbf66af608bc9e873915459c8690278c69769f2e5c03cc5f3cf484d28280bc6a21dc9dce5b6d16650e478db7135002ecbcd47a1c536cdf603894b22a44386b8dfe0264e43c257a492e350fd30e656309746521c76c3db00c7b54694583d89870efe34f25019ab78c1cd36610af8253f5172eb60a95a6c67a87e83a0dbe6b69d2ff899093482845e28e4553912f685625247676d8201cbd7c4359b27af47cd4ec79fe5ff658058198674caa6dd1061502d504cf9ce300209ca0d8b49e1f856b3f1557f6a14febde562f64eb5e5f65385b7d4ff864c235ce69cb0690a057ac55714e9d849eb4ea658becd2b953331bf7308d041fd8eaf5eaab8d81853d57d5cbb8fdcff66f5ca7815c8217861b4249a8728a5e0c75a36fa69cc5520ff1099e79ec58e32f5695049a2fc5a0a58c430220009cb67b9cea3216a65f293acc8e50dd582cddfdec9eacf84aff967b295105d4da03ccbadebec7d87540d51c1524f5ec393b90657fae83a4fc2d6ffaaab9aaad8c79f53f4e4cbc2f26fea408ee27def0436fcb6492b3a5d584ab5a51ef3af6d2da24ee835f59ac37534a4dcd38809a48a6c9b5992d6fb2af5ef98011861e457dfa6c3e55f7e57be5e926fb7eb3ac15173d044adffa9f5f94ed692d5a88adf94ceae299ea9b656a4c14115f08a2fbd8565c18c6465d6bc400679359ba5530a3d6efa2a353f4bf7aff3e6783af688a46e8aa049de2526bf71975045a8dc98adda0afbe5a918432bb5c52a8457882d46961b557b0e1258e55faceddc075649625055a616fee2a1bda215ac7763577d62de0525ce5a0c69eec4a066b65632f6f6086a8bea505dace65d3ec9840734bfb37b41c276cd5d939aa0239938cd0f12a3e9d780dbb8b981d1feabdf651b66c9565e00ba97ad17cafd9d1e9f60dd4e78aebd719c202bfe6939e05f112bf9551d4dee3b70832b5927f7d8ecfc33c9e4fe4aaf3f8426599280c7f54f0fee2b98b99f56ff7cfaa4dc0e3614fb42b400554a7d8c298547547be9cd3bd8e504c39837f404a1beb0d3accc3b904da2b6daa17d35249e3436605c05a0d3889ab29e5e239da172ab05cfdb128ac8b76407e4f645422d0a8e92331d583498e5cebecaa5a3ed67ef4c744a76c1f05b9b9d287d93010bce4dee6a08bd983d2b4513d4c807a936e970003c3bb8aa96bcaead4d5d069a1096a1f723f81302ce8d9fd04c1e223dc8ac8fc0634704586f89c48ca0995f6bb027ace5d5b4ff7a306338f9723e78d1c2e8d069d66ff3628604a2f2d2e9c85705b481b3ccc0013511a7546e5edf4703bf255b24a5a1961214c20805e5af97b9da32a9f3fbfe669551457466df68a7cdd83a25ebc46f7dc66bf69097ca8936d528205b50e3640f8ab3d5483291c10783fb5e4d08384d70b5cb2e7b889555b67948a9dc0d86c2b8861c0ee25e304cc4d95d46e91ec56bc0a4c9fd4a1d352d9c552efc433846d812a6f6b293a454467d9bed1ebd99dc67ad8ba1501b7f8ebfec59d74df1c8f62dd31f19c45a6f8558ae174891fb3fdef62b034c23529c300e9467c3ad995ebd8ab08d0a7503971eb7a5fbbad3fc9d97e914859b229784d7bcd3d65ea2b3ee99e9525082e05628dc9db3c5344c8ae6ea573cd750c2d8491552b99de21586857a0fbb13d8f22758338e0eb63301beff63c8b96ec8c824d2c3a8ac3c00129b8df1af55c41cfcaf86f2aef2f655600de5debe781c9c0c2d38213e1ea6678805be5e4cfb5cdb1b864b4a43cf2c02bd0cfeb78283650f648da84db371a7818a18f35235f7ddaa533c0bb5b8e6090fd04f5e38e1bca9c162cb1e2443d7e5977d99fd5d2034a3ee678515bef09528d67a6657e49b538abe7e05c92753b363e2f58d736d8b5c1ef28ac6b9cb514deb68954419bd20918b33376315f3ef58ff00ec76e27a0681d96d299bb2f5fd89da502556aedfd937d0910af18914eb6621558b6b6dd4295b5faaf022bf4a22a468add59b4f6be46724a3a5ca3c53369663f621d13793847003cd830b606ef70d990f80eaa7226e07d9202ad9afc803f997cb72ed2c
// MAIN SHARE 3: 8057fca00852d064761322d8a762fad17ddf47868bdf50b44b87f704f9422d37e9ab1f38c30e21ce92ee407c679000aa4ea7b5ef7714b1fb1e111f41bef9719b1ebcaf7b1b2fc14aeb50ea1b7def86f51d9645b5dcfd9da5a3c981b23debc1388bbf8fb09fd06055ec72f65205f1b19ac0e5a0ce340a1049c9be024d5845514e9f934ec8004f3652f82f03050f01a73fb0425ceee35e2953c131860bdb5b99b63fd92ede77c3b8ac04b488115586d7ae7563e788c8b57f42bceede2bf52745160f81e7491760b300f3707abaf2020aef8d1eff44276c11f7840d060179fcf00d3a556a7260f385633f7065c2822050a6bb5728a58055a15221a85409dcb81b3cb1e011149cafc17005e3601e9199606acaa6a6991404d2e60ad56382d08997dc7e668dc8b7f4870ded9930e801781c1167599b4ff69a85bea20d04434e333fdda11a7ded6a8a6a5eca9cfe52c8ca756585e4776cc8ff9194d0a9b0373e4b22d402440093fa1cb51ff035d570dd499b3c566443583106a6f76da3358367633b7fd671bcc0a098ebb81b032740804310f15108de00ddc5873199856d74f3c6d3ece59b9549d538cea886be0ebb7bd64bb9cf542cc78c40360b652df602d90db43ac2084725e4838c874f04479ccb2b427e10f539ac474400dd13b480819a9cb2800ffa5decda177df838f91bc7b52765dbda856b513f47a075b8c3fde634fb21daf8030a5dddc8964ace25de6ad11feeafcbccdf315c82bc3fe5a4acc882e4388e05e47b762d0a55a91877af25323647ea2383bc10dd7c31d19fa368418378cd624d1582bcfc443fc3d6922424ea0ff22f170e5bf1a4a6e71c47e12a6eb2dd015b573fc764c931598ea1a8767dcc3ade6ceb950ddcc7fc43f584a1abdd9f1b5e9a12a86e17fc1b322ad54b6c0f1756ffd8fad02298f4ac9f2f3c6cfe584b7089621c871cfc75c958c378160c333a02221f1800d137d8a3e9f1e40f6d94212ddb1086e767feb05d7360f715b15a02401b81c4497aae319764c7b2f4255b30dda404473416a23266fd1b67b6c7c1564da13047da148fb74d8a98078c1b39a33335983577a401d7b811d61f45b55693ec597545aca561dbc43808eb492560ce3778decf9176bcd5f1f6a2eb58f1c78f4b3ea003a1edde7039d1618478be458602a6f9fb079d76a7434724c14d73f44efafd865390ed7bf2c95e0893b3cf4d06afa8cc75b8abf1af95ec4fe0cd8d712cd47b3ccc2c82242aa38106ea3900044fa640286fda7e2978d5665e076a2fc129e62a22698324e7bf0654bafd1c1b12664cfdbe169388bbb04804ea04363e1ea8e1626682e040717e3f152672955d033f6a32408531a3cef19691276a1980384772fde7e099bfacaadc0eee5162064bca6aea1afd883596f1296d7f6451b52557f388d390030656b88b8c92addaf1df343b2b826958e994551a1a447b909182896527bf50b7ca7a2198706a90280b44c25322c7b76bd90cc31cb7c923f6861601f5a2bb9744a8737da0aa2d191e88d521504905fc5f00ba6cf14d5e221eab5a7f73e7deedb8426b8e3105a5904768c1ecdb19a7f376e6a784fe6f69b78b5d2d556e0c37ddca98764f825334b1e030638bd2079ee4085290cf1c5bdab9aedad550e6eeaaf5992af3936a5d397a04f44c1c6ab7f425d0a5a6b0a49aa23eacb09a9461d018d180f250b22f49dfaefcf24b044d33b059201e0e3733363bc22e20164e52f186fb442dedd5726401c35533e89bfecaf665233244ebe4da94887fd192ae7abed6ec71333d7f7098e11b0cbaae9defcddb4ea6ff132a4083df71e1867846e3a4e3b161e8d10fde5281e5becc94e4aead1c5d8b48d1140a872b3204216c50f6909f1817a1530ec405ae00db611cd1623b60afd310c9c45e0912c193c53aac13ca698cc7c52cd215252dbe8fcd97b3000e3e5a4668c44a9493b8c0a912a9133448b5d7613986049b0fb2492df611873dea00498ea096ebb171c0a5cfa050782516ffb6a67a80e8f0c29a4d9afc59fd55ff1eb3711cf95e488b730ae366b81ff0cb9feea92d4c97faddaa518db05ec761e64b49d1d796977d8defdb698c04f204a317815d0e5b7f1989304f42cb7c57c23c4a4ced657bb1891f1f8cda5e6afdcd24f504d6f79ed573c9e7cb6377e19cc0089ca2331f35f46d686e563c49d06b1407db32ab5469eb9ed08660610dc78df445725d61b86ee4c88c0283efa2822d2ddbde5fe25d0dedb77840330b738b87c33df1f9e25ba938d95c6727088a4752c834b32ec2d887c87dbd287131f8d5cd492654ed5
// SECRET: 56bc00664c8fd85f824cac93c26ccc703d1e1a687acb112ed61cda2586fd91a86bf5230cb6077d8539c8bf59008c29b4d799f45bdbce6b7f433dcff2ec416bf3bcf46ba23f05a56a8d6fe4b93ed2537119df50fa71b8980f26cfc1b92fcd22e73ef745788f4699f8c25e08decf412b8d9803f1106f0127ef3809722152057d790d3b2001f55ec2ae3c0c143c88d5f7014ebdb54ab6620fcd0618686a69efd178aa7cf01fc7ac30db126742165c90f09b811e23ebdc3dc3bd7cb6e69a1d53183e891d6393cb0ccac4c8e3e20808a53e73f23d9e9377ce1e103418cceefa00fd6e9be087ca0e9bc5f48f170a86468cd36a92ac164698428688661060fb67e5fb89474355bc3fcc009983477d41ab8f2ba4945d63105485186c9b0e4c026158f8b71a37ebd6121cb971ed8d20cc67778b5a612df65d2adfb40834110df1c578b843e0b9bb2aa76e3b6dfa7e0b23e09b1699d89333ea7941548cefc9d539a24c10091045c66ffb53f6c950dc443561e57697114ae90494d293b8c5168393c5e478d0cf338c45ade7672c821d02014bca42046438443716d541269bfcda0f5c81bd51691560dd23b422d338f3e46819e7277a9e331e31c918a39afe184c24ffd92b08219299120e321d3c115933a22dc07fcadda8311d104473c71202416dfb0a00f66eb9746fd4fee9ea632fd79a9350682a9b6acd3d90c8df23c6b9d1daa240e2200c6e703765192bb650b76c43b1b43f2f74f54232c3f9b1989c332285d9223899d8e496346e9863e890b2ddc11991a60ec77744fcf94041b0832106c423bb097316c3fa31d93f485d869e9d28f6867b1c7ee6889c955b31918aa7f34c34426ad53f9313ed4226b488e8d037f96cb7bd69147033d631c6169c8868717b6a7d6f84af7fd677e5866c15a3307b5ad278ea6c8e4dea9c75b2f5bffa7e21e402ab4f325bfaf8176223c46718f9c528864f7b2044cd58ac81ee8910b3719e8a706b029593d6f346fc83ca5bdf422809472e0711eca4f1419313d7c29e52e544b81011d55794c187d273a3d71b1f4219b8cd01586f12f71d366d201e77e5a8c5c551e9dc901040d767405f3ddf525d8176ec1598bc9b402fd920ad2daa9b03f1d4643b79ccd374dece94856aea071e3de5b400808970f0c9608b06d8eb39161884d2ee2c59fc941d0d921305fcc611f2e2365e498dfce60b623865c70f3d3494b023f8dface688799931b10336fc8a74d8e533be32869ea40e0495e1240011b0198eaf78e0b6ec649b5e3893a63f8aa996a68726829dd73c5edbe273776b8719faff7f5d0eebe701209d28d9d17fb4ad8b871a8501c8ccf17b9ad04d5234c5b3e10902dd880ff2415d8a936f26c921d4c2b99145efb0bc6c30b57e8b08192fa7a56fe236e951d28aabfcb356cf9a52d60e6449000c5ed3222e758470e240f5d9a22e8762ad6156536f29d86945060aab9ad77acb1fe0a641e88f6d8e202d134e820bd7936824334bfb1faac61a5f18ce98c3691d9ce8c4b88ca673633a649a420124de763ccba7fa0572b64fb46ae0f48158b5ff21872ef104985101932389746bdc8710074add8165e63be2979ac5099da1546d12e8784184f0e37c95f8cdc5fcf445ad432cfba47db93f702db4d27b82290248f48906d02195809dc78b896404787e0a89df3b759d9cb47376362d6443102a92e5089e8b76ca5d457b6790420c3b10983844a343748bc1a38c784b03275638630b410fdda4770fa726331f9a744f9a9aff3a3f71d70c00f17e299723116d55c7238c638463c511eb5093cd2618552cf709aafe5f06d5b9280126b44595e7cc078c17b046c8ae53d2f794d02a8dea034d2971e276ee72de7bf3c443fa623922e40ca583d367f60369b1b4aa3575d66cb86e06ff463b9389192d6040595dd436b978a32630da089c4b1e42347ee47b26ed013d0be4761fc13129bdbbdce706637b3e746eb7e237bada1454d2597cdc0fa91fa3c49141330065bcc14bf5de9fbbaf7ed131608f6b1058e5846a9fa9697c02978f04371efe11dc4ebbcfafb51322300a81b00a86ba70687eb14e34b9ffd421c90ce40e2e1fc5fecea9717cdb01b08af220d1a6f077058bad961ed1f6bcebedbc65b3015786b22e5bef
// PRIVATE KEY:  0x00e9d67cd376fe25e84aaf7a3b4623f72ec90224fb2a3c05fbdbd1596c2599e1
// ADDRESS:  0x818a5cF7588ac5C34dD4Cff542CF3a99892f5C10