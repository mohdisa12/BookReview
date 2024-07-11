import express from "express";
import axios from "axios";
import ejs from "ejs";
import bodyparser from "body-parser";
import pg from "pg";
import bcrypt from "bcrypt";

const app = express();
const port = 3000;
const saltCount = 10;

/*let book = [
    {title : "Reaching for Sunrise: A Widow's Memoir",
        author: "Lokita Carter",
        review: "Set against the serene, affluent backdrop of Marin in Northern California, Steve was walking their dog on a popular hiking trail when he was ambushed and shot dead by three young homeless drifters. This act of violence sent shockwaves far beyond the idyllic enclave and into the global media.",
        cover_id: "OL6071583M"
    },
    {
        title: "Elevating Potential: A Guide To Developing Emerging Leaders",
        author: "Pete Premenko",
        review: "If any of us are being honest today, we would have to admit that leading in today’s world is quite challenging. Whether the organization is large or small it is important to have a plan to develop emerging leaders. In Elevating Potential: A Guide to Developing Emerging Leaders, Pete Premenko presents a comprehensive roadmap for cultivating talented leaders within an organization. The book is an answer to the critical need for developing emerging leaders who can operate in the ever changing business landscape.",
        cover_id: "OL6071583M"
    }
];*/

const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "permalist",
  password: "Allahabad@123",
  port: 5433
});

db.connect();

app.use(express.static("public"));
app.use(bodyparser.urlencoded({extended: true}));

async function getLists() {
    try {
        const result = await db.query("SELECT book.id, book, book_author, cover_id, review FROM book JOIN book_review ON book.id = book_review.book_id");
        return result.rows;
    } catch (error) {
        console.error("Database query error:", error);
        throw error; // Re-throw the error to handle it in the calling function
    }
}

async function getList(){
  try {
    console.log(currentId);
    const result = await db.query("SELECT book.id, book, book_author, cover_id, review FROM book JOIN book_review ON book.id = book_review.book_id JOIN users ON users.id = book.user_id WHERE users.id = $1",[userId]);
    console.log(result.rows);
    return result.rows;
} catch (error) {
    console.error("Database query error:", error);
    throw error; // Re-throw the error to handle it in the calling function
}
}

app.get("/",async (req, res) => {
    const books = await getLists();
    res.render("index.ejs", {
        book: books
    });
});

app.get("/book",async (req, res) => {
  if(userId > 0){
    const books = await getList();
    console.log(books);
    res.render("book.ejs", {
      user: books
    });
  }
  else{
    res.render("login.ejs")
  }
  
});

app.get("/login", (req, res) => {
    res.render("login.ejs");
});
  
  app.get("/register", (req, res) => {
    res.render("register.ejs");
});

app.get("/edit", async (req, res) => {
    currentId = req.query.book_id;
    try{
        const result = await db.query("SELECT book, book_author,  review FROM book JOIN book_review ON book.id = book_review.book_id WHERE book.id = $1",[currentId]);
        const data = result.rows[0];
        res.render("review.ejs", {books : data});
    }catch(err){
        console.log("error", err);
    }
});

app.get("/delete", async (req, res) => {
    try{
        currentId = req.query.book_id;
        const result = await db.query("DELETE FROM book_review WHERE book_id = $1", [currentId]);
        const result2 = await db.query("DELETE FROM book WHERE book.id = $1", [currentId]);
        res.redirect("/");
    }catch(err){
        console.log(err);
    }
});

let currentId = 0; // to store the currendid for adding to the reviews table
app.post("/get", async (req, res) => {
    const book = req.body.bookName;
    try{
        const result = await axios.get(`https://openlibrary.org/search.json?q=${encodeURIComponent(book)}&fields=cover_edition_key,title,author_name`);


        if (!result.data.docs[0] || !result.data.docs[0].cover_edition_key || !result.data.docs[0].author_name || !result.data.docs[0].title) {
            throw new Error("Incomplete book data");
        }
        const cover_id = result.data.docs[0].cover_edition_key;
        const author= result.data.docs[0].author_name[0];
        const title= result.data.docs[0].title;
        console.log(author);

        try{
            const dataForDb= await db.query("INSERT INTO book(book, book_author, cover_id, user_id) VALUES ($1, $2, $3, $4) RETURNING *",[title, author, cover_id, userId]);
            //const coverUrl = `https://covers.openlibrary.org/b/olid/${cover_id}-M.jpg`;
            const user = dataForDb.rows[0];
            currentId= user.id;
            res.render("review.ejs", {user});
        }catch(err){
            console.error("Error inserting book:", err);
            res.send("This book is already listed, please try again");
        }
    }catch{
        res.send("Sorry don't have the detail about given book");
    }
});

app.post("/add", async(req ,res) => {
    const review = req.body.reviewTextarea;
    //const now = new Date();
    const result = await db.query("INSERT INTO book_review(review, book_id, review_date) VALUES ($1, $2, CURRENT_TIMESTAMP)",
        [review, currentId]
    );
    res.redirect("/");
});

app.post("/update", async (req, res) => {
    const updatedReview = req.body.reviewTextarea;
    const result= await db.query("UPDATE book_review SET review = $1 WHERE book_id = $2", [updatedReview, currentId]);
    res.redirect("/")
})

app.post("/register", async (req, res) => {
    const email = req.body.username;
    const password = req.body.password;
  
    try {
      const checkResult = await db.query("SELECT * FROM users WHERE email = $1", [
        email,
      ]);
  
      if (checkResult.rows.length > 0) {
        res.send("Email already exists. Try logging in.");
      } else {
        bcrypt.hash(password, saltCount, async (err, hash) => {
          if(err){
            console.log(err);
          }else{
            const result = await db.query(
              "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING *",
              [email, hash]
            );
            const user = result.rows[0];
            userId= user.id;
            res.redirect("/");
          }
        });
      }
        
    } catch (err) {
      console.log(err);
    }
});
  
  let userId = 0;
  app.post("/login", async (req, res) => {
    const email = req.body.username;
    const loginpassword = req.body.password;
  
    try {
      const result = await db.query("SELECT * FROM users WHERE email = $1", [
        email,
      ]);
      if (result.rows.length > 0) {
        const user = result.rows[0];
        userId= user.id;
        console.log(userId);
        const storedPassword = user.password;
  
        bcrypt.compare(loginpassword, storedPassword, (err, result) => {
          if(err){
            console.log(err);
          }if (result) {
            res.redirect("/");
          } else {
            res.send("Incorrect Password");
          }
        });
      }
      else{
        res.send("Wrong id");
      }
    } catch (err) {
      console.log(err);
    }
  });
  app.post("/getBook", async (req, res) => {
      const book = req.body.bookName;
      console.log(book);
      const result = await db.query("SELECT book.id, book, book_author, cover_id, review FROM book JOIN book_review ON book.id = book_review.book_id WHERE Lower(book) LIKE $1",['%' + book.toLocaleLowerCase() + '%']);
      const data= result.rows;
      console.log(data);
      res.render("index.ejs", {
        book: data
      });
  });

app.listen(port, () => {
    console.log(`Server is running in ${port}`);
});