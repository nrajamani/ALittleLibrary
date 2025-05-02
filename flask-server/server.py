from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text
import datetime

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///library.sqlite3'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

class Book(db.Model):
    __tablename__ = 'books'
    book_id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    author_id = db.Column(db.Integer, db.ForeignKey('authors.author_id'), nullable=False)
    genre_id = db.Column(db.Integer, db.ForeignKey('genres.genre_id'), nullable=False)
    published_date = db.Column(db.Date, nullable=False)
    price = db.Column(db.Float, nullable=False)
    availability = db.Column(db.Boolean, default=True)

class Author(db.Model):
    # __tablename__ = 'authors'
    # author_id = db.Column(db.Integer, primary_key=True)
    # first_name = db.Column(db.String(100), nullable=False)
    # last_name = db.Column(db.String(100), nullable=False)
    __tablename__ = 'authors'
    author_id  = db.Column(db.Integer, primary_key=True)
    # index=True gives a single‑column index; below we also create a composite one
    first_name = db.Column(db.String(100), nullable=False, index=True)
    last_name  = db.Column(db.String(100), nullable=False, index=True)
    __table_args__ = (
        # composite index on (first_name, last_name)
        db.Index('idx_authors_name', 'first_name', 'last_name'),
    )

class Genre(db.Model):
    __tablename__ = 'genres'
    genre_id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)

class Customer(db.Model):
    __tablename__ = 'customers'
    customer_id = db.Column(db.Integer, primary_key=True)
    first_name = db.Column(db.String(100), nullable=False)
    last_name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(200), nullable=False)

class Transaction(db.Model):
    __tablename__ = 'transactions'
    transaction_id = db.Column(db.Integer, primary_key=True)
    # book_id = db.Column(db.Integer, db.ForeignKey('books.book_id'), nullable=False)
    # customer_id = db.Column(db.Integer, db.ForeignKey('customers.customer_id'), nullable=False)
    # add indexes on book_id & customer_id so lookups and joins on those are fast
    book_id     = db.Column(db.Integer, db.ForeignKey('books.book_id'), nullable=False, index=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.customer_id'), nullable=False, index=True)
    date_borrowed = db.Column(db.Date, nullable=False)
    date_returned = db.Column(db.Date, nullable=True)

@app.route('/books', methods=['POST'])
def add_book():
    try:
        data = request.json
        # first, ensure author exists (by ORM or text). Here ORM for simplicity:
        author = Author.query.filter_by(
            first_name=data['author_first_name'],
            last_name =data['author_last_name']
        ).first()
        if not author:
            author = Author(
                first_name=data['author_first_name'],
                last_name =data['author_last_name']
            )
            db.session.add(author)
            db.session.commit()

        # then genre
        genre = Genre.query.filter_by(name=data['genre_name']).first()
        if not genre:
            genre = Genre(name=data['genre_name'])
            db.session.add(genre)
            db.session.commit()

        # now insert the book row via prepared statement
        inserted_date = datetime.datetime.strptime(
            data['published_date'], '%Y-%m-%d'
        ).date()
        stmt = text("""
            INSERT INTO books
              (title, author_id, genre_id, published_date, price, availability)
            VALUES
              (:title, :author_id, :genre_id, :published_date, :price, :availability)
        """)
        db.session.execute(stmt, {
            'title'         : data['title'],
            'author_id'     : author.author_id,
            'genre_id'      : genre.genre_id,
            'published_date': inserted_date,
            'price'         : float(data['price']),
            'availability'  : bool(data['availability'])
        })
        db.session.commit()
        return jsonify({'message': 'Book added successfully'}), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400

@app.route('/books/<int:book_id>', methods=['PUT'])
def update_book(book_id):
    try:
        data = request.json

        # 1) parse the new published date
        new_pub = datetime.datetime.strptime(
            data['published_date'], '%Y-%m-%d'
        ).date()

        # 2) find or insert the author
        author_row = db.session.execute(
            text("""
              SELECT author_id 
                FROM authors 
               WHERE first_name = :fn 
                 AND last_name  = :ln
            """),
            {'fn': data['author_first_name'], 'ln': data['author_last_name']}
        ).fetchone()

        if author_row:
            author_id = author_row.author_id
        else:
            # insert new author
            db.session.execute(
                text("""
                  INSERT INTO authors (first_name, last_name)
                  VALUES (:fn, :ln)
                """),
                {'fn': data['author_first_name'], 'ln': data['author_last_name']}
            )
            db.session.commit()
            # then re‑fetch its id
            author_id = db.session.execute(
                text("""
                  SELECT author_id 
                    FROM authors 
                   WHERE first_name = :fn 
                     AND last_name  = :ln
                """),
                {'fn': data['author_first_name'], 'ln': data['author_last_name']}
            ).scalar()

        # 3) find or insert the genre
        genre_row = db.session.execute(
            text("SELECT genre_id FROM genres WHERE name = :name"),
            {'name': data['genre_name']}
        ).fetchone()

        if genre_row:
            genre_id = genre_row.genre_id
        else:
            db.session.execute(
                text("INSERT INTO genres (name) VALUES (:name)"),
                {'name': data['genre_name']}
            )
            db.session.commit()
            genre_id = db.session.execute(
                text("SELECT genre_id FROM genres WHERE name = :name"),
                {'name': data['genre_name']}
            ).scalar()

        # 4) now update the book record
        stmt = text("""
            UPDATE books
               SET title           = :title,
                   author_id       = :author_id,
                   genre_id        = :genre_id,
                   published_date  = :published_date,
                   price           = :price,
                   availability    = :availability
             WHERE book_id = :book_id
        """)
        result = db.session.execute(stmt, {
            'title'          : data['title'],
            'author_id'      : author_id,
            'genre_id'       : genre_id,
            'published_date' : new_pub,
            'price'          : float(data['price']),
            'availability'   : bool(data['availability']),
            'book_id'        : book_id
        })
        db.session.commit()

        if result.rowcount == 0:
            return jsonify({'error': 'Book not found'}), 404

        return jsonify({'message': 'Book updated successfully'}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400


@app.route('/books/<int:book_id>', methods=['DELETE'])
def delete_book(book_id):
    try:
        stmt = text("DELETE FROM books WHERE book_id = :book_id")
        result = db.session.execute(stmt, {'book_id': book_id})
        db.session.commit()

        if result.rowcount == 0:
            return jsonify({'error': 'Book not found'}), 404
        return jsonify({'message': 'Book deleted successfully'}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400

@app.route('/library', methods=['GET'])
def get_books():
    try:
        books = db.session.query(Book, Author, Genre).join(Author, 
            Book.author_id == Author.author_id).join(Genre, 
            Book.genre_id == Genre.genre_id).all()

        book_list = [
            {
                'book_id': book.Book.book_id,
                'title': book.Book.title,
                'author': {'first_name': book.Author.first_name, 'last_name': book.Author.last_name},
                'genre': {'name': book.Genre.name},
                'published_date': book.Book.published_date.strftime('%Y-%m-%d'),
                'price': book.Book.price,
                'availability': book.Book.availability
            }
            for book in books
        ]

        return jsonify(book_list), 200
    except Exception as e:
        app.logger.error(f'Error fetching books: {str(e)}')
        return jsonify({'error': 'Failed to fetch books'}), 500

@app.route('/customers', methods=['POST'])
def add_customer():
    try:
        data = request.json
        stmt = text("""
            INSERT INTO customers (first_name, last_name, email)
            VALUES (:first_name, :last_name, :email)
        """)
        db.session.execute(stmt, {
            'first_name': data['first_name'],
            'last_name': data['last_name'],
            'email': data['email']
        })
        db.session.commit()
        return jsonify({'message': 'Customer added successfully'}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400
    
@app.route('/customers/<int:customer_id>', methods=['PUT'])
def update_customer(customer_id):
    try:
        data = request.json
        stmt = text("""
            UPDATE customers
            SET first_name = :first_name,
                last_name = :last_name,
                email = :email
            WHERE customer_id = :customer_id
        """)
        result = db.session.execute(stmt, {
            'first_name': data['first_name'],
            'last_name': data['last_name'],
            'email': data['email'],
            'customer_id': customer_id
        })
        db.session.commit()

        if result.rowcount == 0:
            return jsonify({'error': 'Customer not found'}), 404

        return jsonify({'message': 'Customer updated successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400
    
@app.route('/customers/<int:customer_id>', methods=['DELETE'])
def delete_customer(customer_id):
    try:
        stmt = text("DELETE FROM customers WHERE customer_id = :customer_id")
        result = db.session.execute(stmt, {'customer_id': customer_id})
        db.session.commit()

        if result.rowcount == 0:
            return jsonify({'error': 'Customer not found'}), 404

        return jsonify({'message': 'Customer deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400



@app.route('/customers', methods=['GET'])
def get_customers():
    try:
        customers = Customer.query.all()
        customer_list = [
            {
                'customer_id': customer.customer_id,
                'first_name': customer.first_name,
                'last_name': customer.last_name,
                'email': customer.email
            }
            for customer in customers
        ]
        return jsonify(customer_list), 200
    except Exception as e:
        app.logger.error(f'Error fetching customers: {str(e)}')
        return jsonify({'error': 'Failed to fetch customers'}), 500

@app.route('/transactions', methods=['POST'])
def add_transaction():
    try:
        data = request.json

        # check if book exists
        book_row = db.session.execute(
            text("SELECT availability FROM books WHERE book_id = :book_id"),
            {'book_id': data['book_id']}
        ).fetchone()
        if not book_row:
            return jsonify({'error': 'Book not found'}), 404
        if not book_row['availability']:
            return jsonify({'error': 'Book is not available'}), 400

        # mark book as unavailable
        db.session.execute(
            text("UPDATE books SET availability = FALSE WHERE book_id = :book_id"),
            {'book_id': data['book_id']}
        )

        # insert the transaction
        borrowed = datetime.datetime.strptime(data['date_borrowed'], '%Y-%m-%d').date()
        returned = None
        if data.get('date_returned'):
            returned = datetime.datetime.strptime(data['date_returned'], '%Y-%m-%d').date()

        db.session.execute(
            text("""
                INSERT INTO transactions
                  (book_id, customer_id, date_borrowed, date_returned)
                VALUES
                  (:book_id, :customer_id, :date_borrowed, :date_returned)
            """),
            {
                'book_id': data['book_id'],
                'customer_id': data['customer_id'],
                'date_borrowed': borrowed,
                'date_returned': returned
            }
        )

        db.session.commit()
        return jsonify({'message': 'Transaction added successfully'}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400

@app.route('/transactions/<int:transaction_id>', methods=['PUT'])
def update_transaction(transaction_id):
    try:
        data = request.json

        # fetch the original transaction so we can compare return‑dates & book‑ids
        orig = db.session.execute(
            text("SELECT book_id, date_returned FROM transactions WHERE transaction_id = :tid"),
            {"tid": transaction_id}
        ).mappings().fetchone()

        if not orig:
            return jsonify({"error": "Transaction not found"}), 404

        orig_book_id   = orig['book_id']
        orig_returned  = orig['date_returned']    # none if not returned yet

        # parse the new values out of the payload
        new_book_id    = data['book_id']
        new_customer_id= data['customer_id']
        new_borrowed   = datetime.datetime.strptime(data['date_borrowed'], '%Y-%m-%d').date()
        new_returned   = None
        if data.get('date_returned'):
            new_returned = datetime.datetime.strptime(data['date_returned'], '%Y-%m-%d').date()

        # update the transactions row
        stmt = text("""
            UPDATE transactions
            SET book_id       = :bid,
                customer_id   = :cid,
                date_borrowed = :db,
                date_returned = :dr
            WHERE transaction_id = :tid
        """)
        result = db.session.execute(stmt, {
            "bid": new_book_id,
            "cid": new_customer_id,
            "db":  new_borrowed,
            "dr":  new_returned,
            "tid": transaction_id
        })

        if result.rowcount == 0:
            db.session.rollback()
            return jsonify({"error": "Transaction not found"}), 404

        # fix the book availability based on how the return date changed
        # if the user didn't switch books, update that one
        if new_book_id == orig_book_id:
            # went from NOT returned -> returned -> free the book
            if orig_returned is None and new_returned is not None:
                db.session.execute(
                    text("UPDATE books SET availability = TRUE WHERE book_id = :bid"),
                    {"bid": new_book_id}
                )
            # went from returned -> no return date -> mark it out again
            elif orig_returned is not None and new_returned is None:
                db.session.execute(
                    text("UPDATE books SET availability = FALSE WHERE book_id = :bid"),
                    {"bid": new_book_id}
                )

        # if they changed which book the transaction is for
        # return the old one (if it wasn’t returned) and
        # borrow the new one (if it hasn’t been returned yet)
        else:
            # free the old if it was still out
            if orig_returned is None:
                db.session.execute(
                    text("UPDATE books SET availability = TRUE WHERE book_id = :bid"),
                    {"bid": orig_book_id}
                )
            # borrow the new if they're not returning it immediately
            if new_returned is None:
                db.session.execute(
                    text("UPDATE books SET availability = FALSE WHERE book_id = :bid"),
                    {"bid": new_book_id}
                )
            else:
                # if they set a return date on the new book, keep it available
                db.session.execute(
                    text("UPDATE books SET availability = TRUE WHERE book_id = :bid"),
                    {"bid": new_book_id}
                )

        db.session.commit()
        return jsonify({"message": "Transaction updated successfully"}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400


@app.route('/transactions/<int:transaction_id>', methods=['DELETE'])
def delete_transaction(transaction_id):
    try:
        # fetch existing transaction
        tx = db.session.execute(
            text("SELECT book_id, date_returned FROM transactions WHERE transaction_id = :id"),
            {'id': transaction_id}
        ).fetchone()
        if not tx:
            return jsonify({'error': 'Transaction not found'}), 404

        # if it wasn’t returned, free the book
        if tx['date_returned'] is None:
            db.session.execute(
                text("UPDATE books SET availability = TRUE WHERE book_id = :book_id"),
                {'book_id': tx['book_id']}
            )

        # delete the row
        db.session.execute(
            text("DELETE FROM transactions WHERE transaction_id = :id"),
            {'id': transaction_id}
        )

        db.session.commit()
        return jsonify({'message': 'Transaction deleted successfully'}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400


@app.route('/transactions', methods=['GET'])
def get_transactions():
    try:
        transactions = db.session.query(Transaction, Book, Customer).join(Book, 
            Transaction.book_id == Book.book_id).join(Customer, 
            Transaction.customer_id == Customer.customer_id).all()

        transaction_list = [
            {
                'transaction_id': transaction.Transaction.transaction_id,
                'book_id': transaction.Transaction.book_id,
                'book_title': transaction.Book.title,
                'customer_name': f'{transaction.Customer.first_name} {transaction.Customer.last_name}',
                'customer_id': transaction.Transaction.customer_id,
                'date_borrowed': transaction.Transaction.date_borrowed.strftime('%Y-%m-%d'),
                'date_returned': transaction.Transaction.date_returned.strftime('%Y-%m-%d') if transaction.Transaction.date_returned else None
            }
            for transaction in transactions
        ]
        return jsonify(transaction_list), 200
    except Exception as e:
        app.logger.error(f'Error fetching transactions: {str(e)}')
        return jsonify({'error': 'Failed to fetch transactions'}), 500

@app.route('/transactions/return', methods=['POST'])
def return_book():
    data = request.json
    transaction = Transaction.query.get(data['transaction_id'])
    if not transaction:
        return jsonify({'error': 'Transaction not found'}), 404
    if transaction.date_returned:
        return jsonify({'error': 'Book already returned'}), 400
    transaction.date_returned = datetime.date.today()
    book = Book.query.get(transaction.book_id)
    book.availability = True
    db.session.commit()
    return jsonify({'message': 'Book returned successfully'}), 200


if __name__ == '__main__':
    with app.app_context():
        db.create_all()

        db.session.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_transactions_book_id "
            "ON transactions(book_id)"
        ))
        db.session.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_transactions_customer_id "
            "ON transactions(customer_id)"
        ))

        db.session.commit()
    app.run(debug=True)
