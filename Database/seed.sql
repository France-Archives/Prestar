INSERT INTO categories (category_name)
VALUES
('Fiction'), ('Science'), ('Technology'), ('Programming'), ('History'),
('Mathematics'), ('Business'), ('Self-Help'), ('Education'), ('Literature');

INSERT INTO authors (author_name)
VALUES
('J.K. Rowling'), ('George Orwell'), ('Robert C. Martin'), ('Harper Lee'),
('James Clear'), ('J.R.R. Tolkien'), ('Stephen Hawking'), ('Yuval Noah Harari'),
('Paulo Coelho'), ('Jane Austen'), ('Mark Twain'), ('Ernest Hemingway'),
('F. Scott Fitzgerald'), ('Dan Brown'), ('Agatha Christie'), ('Stephen King'),
('Suzanne Collins'), ('John Green'), ('Rick Riordan'), ('Brandon Sanderson'),
('Charles Dickens'), ('William Shakespeare'), ('Leo Tolstoy'), ('Victor Hugo'),
('Fyodor Dostoevsky'), ('Isaac Asimov'), ('Arthur C. Clarke'), ('Martin Fowler'),
('Andrew Hunt'), ('David Thomas'), ('Thomas H. Cormen'), ('Donald Knuth'),
('E. Balagurusamy'), ('Bjarne Stroustrup'), ('Jon Duckett'), ('Eric Matthes'),
('Kyle Simpson'), ('Marijn Haverbeke'), ('Brian Kernighan'), ('Dennis Ritchie');

INSERT INTO users
(username, first_name, middle_name, last_name, email, password, role)
VALUES
('juan123', 'Juan', 'D.', 'Dela Cruz', 'juan@example.com', 'password123', 'student'),
('maria123', 'Maria', 'S.', 'Santos', 'maria@example.com', 'password123', 'student'),
('pedro123', 'Pedro', 'R.', 'Reyes', 'pedro@example.com', 'password123', 'student'),
('ana123', 'Ana', 'M.', 'Garcia', 'ana@example.com', 'password123', 'student'),
('carlos123', 'Carlos', 'J.', 'Mendoza', 'carlos@example.com', 'password123', 'student'),
('librarian01', 'Angela', NULL, 'Cruz', 'angela@example.com', 'password123', 'librarian'),
('admin01', 'Michael', NULL, 'Torres', 'michael@example.com', 'password123', 'admin');

INSERT INTO books
(title, isbn, author_id, category_id, quantity, available_quantity)
VALUES
('Harry Potter and the Sorcerer''s Stone','9780439708180',1,1,5,5),
('Harry Potter and the Chamber of Secrets','9780439064866',1,1,4,4),
('1984','9780451524935',2,1,5,5),
('Animal Farm','9780451526342',2,10,3,3),
('Clean Code','9780132350884',3,4,5,5),
('The Clean Coder','9780137081073',3,4,3,3),
('To Kill a Mockingbird','9780061120084',4,10,4,4),
('Atomic Habits','9780735211292',5,8,6,6),
('The Hobbit','9780547928227',6,1,5,5),
('The Lord of the Rings','9780544003415',6,1,5,5),
('A Brief History of Time','9780553380163',7,2,4,4),
('Sapiens','9780062316097',8,5,5,5),
('The Alchemist','9780062315007',9,10,4,4),
('Pride and Prejudice','9780141439518',10,10,4,4),
('Adventures of Huckleberry Finn','9780486280615',11,1,3,3),
('The Old Man and the Sea','9780684801223',12,10,3,3),
('The Great Gatsby','9780743273565',13,10,4,4),
('The Da Vinci Code','9780307474278',14,1,5,5),
('Murder on the Orient Express','9780062693662',15,1,4,4),
('The Shining','9780307743657',16,1,3,3),
('The Hunger Games','9780439023481',17,1,5,5),
('The Fault in Our Stars','9780525478812',18,10,4,4),
('Percy Jackson and the Olympians','9780786856299',19,1,5,5),
('Mistborn','9780765311788',20,1,4,4),
('A Tale of Two Cities','9780486406510',21,5,3,3),
('Romeo and Juliet','9780743477116',22,10,4,4),
('War and Peace','9780199232765',23,5,3,3),
('Les Miserables','9780451419439',24,5,3,3),
('Crime and Punishment','9780486415871',25,10,4,4),
('Foundation','9780553293357',26,2,4,4),
('2001: A Space Odyssey','9780451457998',27,2,4,4),
('Refactoring','9780134757599',28,4,3,3),
('The Pragmatic Programmer','9780135957059',29,4,5,5),
('Effective Java','9780134685991',30,4,4,4),
('Introduction to Algorithms','9780262046305',31,4,5,5),
('The Art of Computer Programming','9780201896831',32,4,3,3),
('Object-Oriented Programming','9780070432088',33,4,4,4),
('The C++ Programming Language','9780321563842',34,4,4,4),
('HTML and CSS','9781118008188',35,3,5,5),
('Python Crash Course','9781593279288',36,4,5,5),
('You Don''t Know JS','9781491904244',37,4,4,4),
('Eloquent JavaScript','9781593279509',38,4,4,4),
('The C Programming Language','9780131103627',39,4,4,4),
('Programming in C','9788120343411',40,4,3,3),
('The Science Book','9781405357343',7,2,3,3),
('21 Lessons for the 21st Century','9780525512172',8,5,4,4),
('The Power of Habit','9780812981605',5,8,5,5),
('The Elements of Mathematics','9780000000001',33,6,3,3),
('Business Fundamentals','9780000000002',29,7,4,4),
('Learning and Teaching Strategies','9780000000003',36,9,3,3);

INSERT INTO borrow_requests
(user_id, book_id, request_date, status)
VALUES
(1,5,'2026-09-20','Approved'),
(2,8,'2026-09-21','Approved'),
(3,10,'2026-09-22','Pending'),
(4,15,'2026-09-23','Rejected'),
(5,21,'2026-09-24','Approved'),
(1,32,'2026-09-25','Pending'),
(2,40,'2026-09-26','Approved'),
(3,1,'2026-09-27','Pending');

INSERT INTO borrowings
(request_id, borrow_date, due_date, return_date, status)
VALUES
(1,'2026-09-21','2026-10-05',NULL,'Borrowed'),
(2,'2026-09-22','2026-10-06',NULL,'Borrowed'),
(5,'2026-09-25','2026-10-09','2026-10-01','Returned'),
(7,'2026-09-27','2026-10-11',NULL,'Borrowed');
