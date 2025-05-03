import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Route, Routes, Link } from "react-router-dom";
import './App.css';

function App() {
  const [view, setView] = useState("books");
  const [editCustomer, setEditCustomer] = useState(null);
  const [editBook, setEditBook] = useState(null);
  const [editTransaction, setEditTransaction] = useState(null);

  const initialFilter = {
    title: "", author: "", genre: "", availability: "",
    customer_name: "", email: "", transaction_book_title: "",
    transaction_customer_name: "", date_borrowed: "", date_returned: "",
    book_id: "", customer_id: "", transaction_id: ""
  };

  // const [filter, setFilter] = useState({
  //   title: "", author: "", genre: "", availability: "",
  //   customer_name: "", email: "", transaction_book_title: "",
  //   transaction_customer_name: "", date_borrowed: "",
  //   date_returned: "", book_id: "", customer_id: "", transaction_id: ""
  // });

  const [book, setBook] = useState({
    title: "", author_first_name: "",
    author_last_name: "", genre_name: "",
    published_date: "", price: "", availability: true,
  });

  const [customer, setCustomer] = useState({
    first_name: "", last_name: "", email: "",
  });

  const [transaction, setTransaction] = useState({
    book_id: "", customer_id: "", date_borrowed: "", date_returned: "",
  });

  const [filter, setFilter] = useState(initialFilter);
  const [appliedFilter, setAppliedFilter] = useState(initialFilter);
  const [books, setBooks] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    fetch("/library").then(r => r.json()).then(setBooks);
    fetch("/customers").then(r => r.json()).then(setCustomers);
    fetch("/transactions").then(r => r.json()).then(setTransactions);
  }, []);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilter(f => ({ ...f, [name]: value }));
  };
  const applyFilter = () => setAppliedFilter(filter);

  const filteredBooks = books.filter((book) => {
    const bookTitle = book.title ? book.title.toLowerCase() : "";
    const bookAuthor = book.author ? `${book.author.first_name ?? ""} ${book.author.last_name ?? ""}`.toLowerCase().trim() : "";
    const bookGenre = book.genre ? book.genre.name.toLowerCase() : "";
    return (
      (appliedFilter.book_id === "" || book.book_id.toString().includes(appliedFilter.book_id)) &&
      (appliedFilter.title === "" || bookTitle.includes(appliedFilter.title.toLowerCase())) &&
      (appliedFilter.author === "" || bookAuthor.includes(appliedFilter.author.toLowerCase())) &&
      (appliedFilter.genre === "" || bookGenre.includes(appliedFilter.genre.toLowerCase())) &&
      (appliedFilter.availability === "" || (appliedFilter.availability === "true" ? book.availability : !book.availability))
    );
  });

  const filteredCustomers = customers.filter((customer) =>
    (appliedFilter.customer_id === "" || customer.customer_id.toString().includes(appliedFilter.customer_id)) &&
    (appliedFilter.customer_name === "" || `${customer.first_name} ${customer.last_name}`.toLowerCase().includes(appliedFilter.customer_name.toLowerCase())) &&
    (appliedFilter.email === "" || customer.email.toLowerCase().includes(appliedFilter.email.toLowerCase()))
  );

  const filteredTransactions = transactions.filter(tx =>
    (appliedFilter.transaction_id === "" ||
       tx.transaction_id.toString().includes(appliedFilter.transaction_id)) &&
    (appliedFilter.book_id === "" ||
       tx.book_id.toString().includes(appliedFilter.book_id)) &&
    (appliedFilter.customer_id === "" ||
       tx.customer_id.toString().includes(appliedFilter.customer_id)) &&
    (appliedFilter.date_borrowed === "" ||
       tx.date_borrowed === appliedFilter.date_borrowed) &&
    (appliedFilter.date_returned === "" ||
       tx.date_returned === appliedFilter.date_returned)
  );
  

  const handleChange = (e, setter) => {
    const { name, value } = e.target;
    setter(prev => ({ ...prev, [name]: name==="availability"? value==="true" : value }));
  };

  const handleSubmit = async (e, url, data, msg) => {
    e.preventDefault();
    const res = await fetch(url, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify(data)
    });
    if (res.ok) {
      alert(msg);
      window.location.reload();
    } else {
      const err = await res.json();
      alert(err.error || "Request failed");
    }
  };

  const countBooksByGenre = (booksArray) => {
    return booksArray.reduce((counts, book) => {
      if (book.genre && book.genre.name) {
        const genreName = book.genre.name.toLowerCase();
        counts[genreName] = (counts[genreName] || 0) + 1;
      }
      return counts;
    }, {});
  };

  const avgBookPrice = (books) => {
    if (books.length === 0) return 0;
    
    // Sum all book prices
    const totalPrice = books.reduce((sum, book) => {
      const price = book.price && !isNaN(parseFloat(book.price)) 
        ? parseFloat(book.price) 
        : 0;
      
      return sum + price;
    }, 0);
    
    return totalPrice / books.length;
  };

  const booksNotReturned = (booksArray) => {
    if (booksArray.length === 0) return 0;
    
    return booksArray.reduce((count, book) => {
      if (!book.availability) {
        return count + 1;
      }
      return count;
    }, 0);
  };

  const genreCounts = countBooksByGenre(filteredBooks);
  const fictionCount = genreCounts["fiction"] || 0;
  const romanceCount = genreCounts["romance"] || 0;
  const mysteryCount = genreCounts["mystery"] || 0;
  const fantasyCount = genreCounts["fantasy"] || 0;
  const memoirCount = genreCounts["memoir"] || 0;
  const nonfictionCount = genreCounts["nonfiction"] || 0;
  const avgFilteredBookPrice = avgBookPrice(filteredBooks);
  const unreturnedBooks = filteredTransactions.filter(tx => !tx.date_returned).length;
  const returnedBooks   = filteredTransactions.filter(tx => !!tx.date_returned).length;

  // const refreshPage = window.location.reload();

  return (
    <Router>
      <div>
        <h1>A Little Library</h1>
        <nav>
          <Link to="/books">Add Book</Link> |{" "}
          <Link to="/customers">Add Customer</Link> |{" "}
          <Link to="/transactions">Add Transaction</Link> |{" "}
          <Link to="/view">View Data</Link>
        </nav>

        <Routes>
          {/* ----- View Data ----- */}
          <Route path="/view" element={
            <div>
              <select onChange={e => {const newView = e.target.value; setView(newView); 
                setFilter(initialFilter); setAppliedFilter(initialFilter); }} value={view}>
                <option value="books">View Books</option>
                <option value="customers">View Customers</option>
                <option value="transactions">View Transactions</option>
              </select>

              {view === "books" && (
                <div className="library-container">
                  <div className="filter-sidebar">
                    <h3>Filters</h3>
                    <input name="book_id" placeholder="Book ID" onChange={handleFilterChange} />
                    <input name="title"   placeholder="Title"   onChange={handleFilterChange} />
                    <input name="author"  placeholder="Author"  onChange={handleFilterChange} />
                    <input name="genre"   placeholder="Genre"   onChange={handleFilterChange} />
                    <select name="availability" onChange={handleFilterChange}>
                      <option value="">All</option>
                      <option value="true">Available</option>
                      <option value="false">Not Available</option>
                    </select>
                    <button onClick={applyFilter}>Apply Filters</button>
                  </div>

                  <table>
                    <thead>
                      <tr>
                        <th>Book ID</th>
                        <th>Title</th>
                        <th>Author First</th>
                        <th>Author Last</th>
                        <th>Genre</th>
                        <th>Price</th>
                        <th>Published</th>
                        <th>Availability</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBooks.map(b => (
                        <tr key={b.book_id}>
                          <td>{b.book_id}</td>

                          {editBook?.book_id === b.book_id ? (
                            <>
                              <td>
                                <input
                                  type="text"
                                  value={editBook.title}
                                  onChange={e => setEditBook({ ...editBook, title: e.target.value })}
                                />
                              </td>
                              <td>
                                <input
                                  type="text"
                                  value={editBook.author_first_name}
                                  onChange={e => setEditBook({ ...editBook, author_first_name: e.target.value })}
                                />
                              </td>
                              <td>
                                <input
                                  type="text"
                                  value={editBook.author_last_name}
                                  onChange={e => setEditBook({ ...editBook, author_last_name: e.target.value })}
                                />
                              </td>
                              <td>
                                <input
                                  type="text"
                                  value={editBook.genre_name}
                                  onChange={e => setEditBook({ ...editBook, genre_name: e.target.value })}
                                />
                              </td>
                              <td>
                                <input
                                  type="number" step="0.01"
                                  value={editBook.price}
                                  onChange={e => setEditBook({ ...editBook, price: e.target.value })}
                                />
                              </td>
                              <td>
                                <input
                                  type="date"
                                  value={editBook.published_date}
                                  onChange={e => setEditBook({ ...editBook, published_date: e.target.value })}
                                />
                              </td>
                              <td>
                                <select
                                  value={editBook.availability.toString()}
                                  onChange={e => setEditBook({ ...editBook, availability: e.target.value === "true" })}
                                >
                                  <option value="true">Available</option>
                                  <option value="false">Not Available</option>
                                </select>
                              </td>
                            </>
                          ) : (
                            <>
                              <td>{b.title}</td>
                              <td>{b.author.first_name}</td>
                              <td>{b.author.last_name}</td>
                              <td>{b.genre.name}</td>
                              <td>${b.price}</td>
                              <td>{b.published_date}</td>
                              <td>{b.availability ? "Yes" : "No"}</td>
                            </>
                          )}

                          <td>
                            {editBook?.book_id === b.book_id ? (
                              <>
                                <button onClick={async () => {
                                  const res = await fetch(`/books/${b.book_id}`, {
                                    method: "PUT",
                                    headers: {"Content-Type": "application/json"},
                                    body: JSON.stringify(editBook)
                                  });
                                  if (res.ok) {
                                    setEditBook(null);
                                    window.location.reload();
                                  } else {
                                    const err = await res.json();
                                    alert(err.error || "Update failed");
                                  }
                                }}>
                                  Save
                                </button>
                                <button onClick={() => setEditBook(null)}>
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => setEditBook({
                                  book_id: b.book_id,
                                  title: b.title,
                                  author_first_name: b.author.first_name,
                                  author_last_name: b.author.last_name,
                                  genre_name: b.genre.name,
                                  price: b.price,
                                  published_date: b.published_date,
                                  availability: b.availability,
                                })}>
                                  Edit
                                </button>
                                <button onClick={async () => {
                                  if (!window.confirm("Really delete this book?")) return;
                                  const res = await fetch(`/books/${b.book_id}`, { method: "DELETE" });
                                  if (res.ok) window.location.reload();
                                  else {
                                    const err = await res.json();
                                    alert(err.error || "Delete failed");
                                  }
                                }}>
                                  Delete
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="filter-sidebar"> 
                  <h3>Statistics</h3>
                  <p> Overall Book Count: {filteredBooks.length} </p>
                  <p> Fiction Books: {fictionCount}</p>
                  <p> Romance Books: {romanceCount}</p>
                  <p> Mystery Books: {mysteryCount}</p>
                  <p> Fantasy Books: {fantasyCount}</p>
                  <p> Nonfiction Books: {nonfictionCount}</p>
                  <p> Memoir Books: {memoirCount} </p>
                  <p> Average Price of Books: {avgFilteredBookPrice}</p>
                  </div>
                </div>
              )}

              {view === "customers" && (
                <div className="library-container">
                  <div className="filter-sidebar">
                    <h3>Filters</h3>
                    <input type="text" name="customer_id" placeholder="Filter by Customer ID" onChange={handleFilterChange} />
                    <input type="text" name="customer_name" placeholder="Filter by name" onChange={handleFilterChange} />
                    <input type="text" name="email" placeholder="Filter by email" onChange={handleFilterChange} />
                    <button onClick={applyFilter}>Apply Filters</button>
                  </div>
                  <table>
                    <thead>
                      <tr>
                        <th>Customer ID</th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCustomers.map(customer => (
                        <tr key={customer.customer_id}>
                          <td>{customer.customer_id}</td>
                          <td>
                            {editCustomer?.customer_id === customer.customer_id ? (
                              <>
                                <input
                                  type="text"
                                  value={editCustomer.first_name}
                                  onChange={(e) => setEditCustomer({ ...editCustomer, first_name: e.target.value })}
                                  placeholder="First name"
                                />
                                <input
                                  type="text"
                                  value={editCustomer.last_name}
                                  onChange={(e) => setEditCustomer({ ...editCustomer, last_name: e.target.value })}
                                  placeholder="Last name"
                                />
                              </>
                            ) : (
                              `${customer.first_name} ${customer.last_name}`
                            )}
                          </td>
                          <td>
                            {editCustomer?.customer_id === customer.customer_id ? (
                              <>
                                <input
                                  type="email"
                                  value={editCustomer.email}
                                  onChange={(e) => setEditCustomer({ ...editCustomer, email: e.target.value })}
                                  placeholder="Email"
                                />
                              </>
                            ) : (
                              customer.email
                            )}
                          </td>
                          <td>
                            {editCustomer?.customer_id === customer.customer_id ? (
                              <>
                                <button
                                  onClick={() => {
                                    fetch(`/customers/${customer.customer_id}`, {
                                      method: "PUT",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify(editCustomer),
                                    })
                                      .then((res) => res.json())
                                      .then(() => {
                                        setEditCustomer(null);
                                        window.location.reload();
                                      });
                                  }}
                                >
                                  Save
                                </button>
                                <button onClick={() => setEditCustomer(null)}>Cancel</button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => setEditCustomer(customer)}>Edit</button>
                                <button
                                  onClick={() => {
                                    if (window.confirm("Are you sure you want to delete this customer?")) {
                                      fetch(`/customers/${customer.customer_id}`, {
                                        method: "DELETE",
                                      })
                                        .then((res) => res.json())
                                        .then(() => window.location.reload());
                                    }
                                  }}
                                >
                                  Delete
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>

                  </table>
                  <div className="filter-sidebar"> 
                  <h3>Statistics</h3>
                  <p> Customer Count: {filteredCustomers.length} </p>
                  </div>
                  <p> </p>
                </div>
              )}

              {view==="transactions" && (
                <div className="library-container">
                  <div className="filter-sidebar">
                    <h3>Filters</h3>
                    <input type="text" name="transaction_id"
                      placeholder="Filter by Transaction ID"
                      onChange={handleFilterChange} />
                    <input type="text" name="book_id"
                      placeholder="Filter by Book ID"
                      onChange={handleFilterChange} />
                    <input type="text"name="customer_id"
                      placeholder="Filter by Customer ID"
                      onChange={handleFilterChange} />
                    <input type="date" name="date_borrowed"
                      onChange={handleFilterChange} />
                    <input type="date" name="date_returned"
                      onChange={handleFilterChange} />
                    <button onClick={applyFilter}>Apply Filters</button>
                  </div>

                  <table>
                    <thead>
                      <tr>
                        <th>Transaction ID</th>
                        <th>Book ID</th>
                        <th>Customer ID</th>
                        <th>Borrowed</th>
                        <th>Returned</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTransactions.map(tx => (
                        <tr key={tx.transaction_id}>
                          {/* ID is never editable */}
                          <td>{tx.transaction_id}</td>

                          {editTransaction?.transaction_id === tx.transaction_id ? (
                            <>
                              {/* book_id */}
                              <td>
                                <input
                                  type="number"
                                  value={editTransaction.book_id}
                                  onChange={e => setEditTransaction({
                                    ...editTransaction,
                                    book_id: parseInt(e.target.value, 10)
                                  })}
                                />
                              </td>
                              {/* customer_id */}
                              <td>
                                <input
                                  type="number"
                                  value={editTransaction.customer_id}
                                  onChange={e => setEditTransaction({
                                    ...editTransaction,
                                    customer_id: parseInt(e.target.value, 10)
                                  })}
                                />
                              </td>
                              {/* date_borrowed */}
                              <td>
                                <input
                                  type="date"
                                  value={editTransaction.date_borrowed}
                                  onChange={e => setEditTransaction({
                                    ...editTransaction,
                                    date_borrowed: e.target.value
                                  })}
                                />
                              </td>
                              {/* date_returned */}
                              <td>
                                <input
                                  type="date"
                                  value={editTransaction.date_returned}
                                  onChange={e => setEditTransaction({
                                    ...editTransaction,
                                    date_returned: e.target.value
                                  })}
                                />
                              </td>
                            </>
                          ) : (
                            <>
                              <td>{tx.book_id}</td>
                              <td>{tx.customer_id}</td>
                              <td>{tx.date_borrowed}</td>
                              <td>{tx.date_returned||"Not Returned"}</td>
                            </>
                          )}

                          <td>
                            {editTransaction?.transaction_id===tx.transaction_id ? (
                              <>
                                <button onClick={async()=>{
                                  const res = await fetch(
                                    `/transactions/${tx.transaction_id}`, {
                                      method:"PUT",
                                      headers:{"Content-Type":"application/json"},
                                      body: JSON.stringify({
                                        book_id: editTransaction.book_id,
                                        customer_id: editTransaction.customer_id,
                                        date_borrowed: editTransaction.date_borrowed,
                                        date_returned: editTransaction.date_returned || null
                                      })
                                    }
                                  );
                                  if(res.ok){
                                    setEditTransaction(null);
                                    window.location.reload();
                                  } else {
                                    const err = await res.json();
                                    alert(err.error||"Update failed");
                                  }
                                }}>Save</button>
                                <button onClick={()=>setEditTransaction(null)}>Cancel</button>
                              </>
                            ) : (
                              <>
                                <button onClick={()=>setEditTransaction({
                                  transaction_id: tx.transaction_id,
                                  book_id: tx.book_id,
                                  customer_id: tx.customer_id,
                                  date_borrowed: tx.date_borrowed,
                                  date_returned: tx.date_returned||""
                                })}>Edit</button>
                                <button onClick={async()=>{
                                  if(!window.confirm("Really delete this transaction?")) return;
                                  const res = await fetch(
                                    `/transactions/${tx.transaction_id}`, { method:"DELETE" }
                                  );
                                  if(res.ok) window.location.reload();
                                  else {
                                    const err = await res.json();
                                    alert(err.error||"Delete failed");
                                  }
                                }}>Delete</button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="filter-sidebar">
                    <h3>Statistics</h3>
                    <p>Transaction Count: {filteredTransactions.length}</p>
                    <p> Books Returned: {returnedBooks} </p>
                    <p> Books Not Returned: {unreturnedBooks} </p>
                  </div>
                </div>
              )}
            </div>
          } />

          <Route path="/books" element={
            <form onSubmit={(e) => handleSubmit(e, "/books", book, "Book added successfully!")}> 
              <input type="text" name="title" placeholder="Title" onChange={(e) => handleChange(e, setBook)} required />
              <input type="text" name="author_first_name" placeholder="Author First Name" onChange={(e) => handleChange(e, setBook)} required />
              <input type="text" name="author_last_name" placeholder="Author Last Name" onChange={(e) => handleChange(e, setBook)} required />
              <input type="text" name="genre_name" placeholder="Genre Name" onChange={(e) => handleChange(e, setBook)} required />
              <input type="date" name="published_date" onChange={(e) => handleChange(e, setBook)} required />
              <input type="number" step="0.01" name="price" placeholder="Price" onChange={(e) => handleChange(e, setBook)} required />
              <select name="availability" onChange={(e) => handleChange(e, setBook)}>
                <option value="true">Available</option>
                <option value="false">Not Available</option>
              </select>
              <button type="submit">Add Book</button>
            </form>
          } />

          <Route path="/customers" element={
            <form onSubmit={(e) => handleSubmit(e, "/customers", customer, "Customer added successfully!")}> 
              <input type="text" name="first_name" placeholder="Customer First Name" onChange={(e) => handleChange(e, setCustomer)} required />
              <input type="text" name="last_name" placeholder="Customer Last Name" onChange={(e) => handleChange(e, setCustomer)} required />
              <input type="text" name="email" placeholder="Email" onChange={(e) => handleChange(e, setCustomer)} required />
              <button type="submit">Add Customer</button>
            </form>
          } />
          <Route path="/transactions" element={
            <form onSubmit={(e) => handleSubmit(e, "/transactions", transaction, "Transaction added successfully!")}> 
              <input type="number" name="book_id" placeholder="Book ID" onChange={(e) => handleChange(e, setTransaction)} required />
              <input type="number" name="customer_id" placeholder="Customer ID" onChange={(e) => handleChange(e, setTransaction)} required />
              <input type="date" name="date_borrowed" onChange={(e) => handleChange(e, setTransaction)} required />
              <input type="date" name="date_returned" onChange={(e) => handleChange(e, setTransaction)} />
              <button type="submit">Add Transaction</button>
            </form>
          } />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
