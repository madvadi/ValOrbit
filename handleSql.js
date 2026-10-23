
function sqlInit(){
  let mysql = require('mysql');
  let db = require('dotenv/config');

  let con = mysql.createConnection({
	  host: "localhost",
	  user: "root",
	  password: "password",
	  database:"mysql"
  });

  con.connect(function(err) {
	  if (err) throw err;
	  console.log("Connected!");
	  /*
	    let sql = "CREATE TABLE customers (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255), address VARCHAR(255))";
	    
	    con.query(sql, function (err, result) {
		        if (err) throw err;
		        console.log("Table created");
		});*/
  });
};


module.exports = {
	sqlInit
};
