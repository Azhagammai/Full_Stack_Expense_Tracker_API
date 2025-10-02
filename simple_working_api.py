#!/usr/bin/env python3
"""
Simple Working API - Fixed JWT Issues
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_pymongo import PyMongo
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from flask_bcrypt import Bcrypt
from datetime import datetime, timedelta
import os
from bson import ObjectId

app = Flask(__name__)
CORS(app, origins=["*"], allow_headers=["Content-Type", "Authorization"], methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])

# MongoDB Configuration
app.config['MONGO_URI'] = 'mongodb://localhost:27017/expense_tracker'
app.config['JWT_SECRET_KEY'] = 'KdQ8MBny_gA-Rt7pdVTP69wnzxvJxnelYqBx8VaXQBY'
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(days=7)

# Initialize extensions
mongo = PyMongo(app)
jwt = JWTManager(app)
bcrypt = Bcrypt(app)

# Predefined expense categories
EXPENSE_CATEGORIES = ['Groceries', 'Leisure', 'Electronics', 'Utilities', 'Clothing', 'Health', 'Others']

# ROUTES

@app.route('/')
def home():
    return jsonify({
        'message': 'Enhanced Expense Tracker API with Income & Savings',
        'status': 'success',
        'version': '2.0.0',
        'database': 'MongoDB Connected',
        'features': [
            'User Authentication with JWT',
            'Complete Expense CRUD (Create, Read, Update, Delete)',
            'Global Category Amount Tracking',
            'Monthly Income Tracking',
            'Accurate Balance & Savings Calculation',
            'Advanced Expense Filtering (Past Week, Last Month, Last 3 Months, Custom Dates)',
            'Category-wise Expense Analysis'
        ],
        'endpoints': {
            'auth': ['/api/users/register', '/api/users/login'],
            'categories': ['GET/POST /api/categories'],
            'expenses': ['GET/POST /api/expenses', 'PUT/DELETE /api/expenses/<id>'],
            'income': ['GET/POST /api/income'],
            'savings': ['GET /api/savings'],
            'filters': ['?filter=past_week|last_month|last_3_months|custom&start_date=&end_date=']
        }
    })

@app.route('/health')
def health():
    try:
        users_count = mongo.db.users.count_documents({})
        categories_count = mongo.db.categories.count_documents({})
        expenses_count = mongo.db.expenses.count_documents({})
        
        return jsonify({
            'status': 'healthy',
            'message': 'API is operational',
            'timestamp': datetime.utcnow().isoformat(),
            'database': 'MongoDB Connected',
            'data_counts': {
                'users': users_count,
                'categories': categories_count,
                'expenses': expenses_count
            }
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'Database connection failed: {str(e)}',
            'database': 'MongoDB Connection Error'
        }), 500

# USER AUTHENTICATION

@app.route('/api/users/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        
        required = ['first_name', 'last_name', 'email', 'password']
        for field in required:
            if not data.get(field):
                return jsonify({'status': 'error', 'message': f'{field} is required'}), 400
        
        email = data['email'].lower()
        
        existing_user = mongo.db.users.find_one({'email': email})
        if existing_user:
            return jsonify({'status': 'error', 'message': 'User already exists'}), 400
        
        hashed_password = bcrypt.generate_password_hash(data['password']).decode('utf-8')
        
        user_doc = {
            'first_name': data['first_name'],
            'last_name': data['last_name'],
            'email': email,
            'password': hashed_password,
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
        
        result = mongo.db.users.insert_one(user_doc)
        user_id = str(result.inserted_id)
        
        # Create simple JWT token
        token = create_access_token(identity=user_id)
        
        return jsonify({
            'status': 'success',
            'message': 'User registered successfully',
            'data': {
                'user': {
                    'id': user_id,
                    'first_name': data['first_name'],
                    'last_name': data['last_name'],
                    'email': email
                },
                'token': token
            }
        }), 201
        
    except Exception as e:
        return jsonify({'status': 'error', 'message': f'Registration failed: {str(e)}'}), 500

@app.route('/api/users/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        
        if not data.get('email') or not data.get('password'):
            return jsonify({'status': 'error', 'message': 'Email and password required'}), 400
        
        email = data['email'].lower()
        
        user = mongo.db.users.find_one({'email': email})
        if not user:
            return jsonify({'status': 'error', 'message': 'Invalid credentials'}), 401
        
        if not bcrypt.check_password_hash(user['password'], data['password']):
            return jsonify({'status': 'error', 'message': 'Invalid credentials'}), 401
        
        # Create simple JWT token
        token = create_access_token(identity=str(user['_id']))
        
        return jsonify({
            'status': 'success',
            'message': 'Login successful',
            'data': {
                'user': {
                    'id': str(user['_id']),
                    'first_name': user['first_name'],
                    'last_name': user['last_name'],
                    'email': user['email']
                },
                'token': token
            }
        }), 200
        
    except Exception as e:
        return jsonify({'status': 'error', 'message': f'Login failed: {str(e)}'}), 500

# CATEGORY ENDPOINTS

@app.route('/api/categories', methods=['GET'])
@jwt_required()
def get_categories():
    try:
        user_id = get_jwt_identity()
        
        user_categories = list(mongo.db.categories.find({'user_id': user_id}))
        
        for cat in user_categories:
            cat['id'] = str(cat['_id'])
            del cat['_id']
            cat['created_at'] = cat['created_at'].isoformat() if 'created_at' in cat else None
            # Ensure total_amount and expense_count exist for older categories
            if 'total_amount' not in cat:
                cat['total_amount'] = 0.0
            if 'expense_count' not in cat:
                cat['expense_count'] = 0
        
        return jsonify({
            'status': 'success',
            'data': {
                'categories': user_categories,
                'available_categories': EXPENSE_CATEGORIES
            }
        })
        
    except Exception as e:
        return jsonify({'status': 'error', 'message': f'Failed to fetch categories: {str(e)}'}), 500

@app.route('/api/categories', methods=['POST'])
@jwt_required()
def create_category():
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data.get('title') or not data.get('description'):
            return jsonify({'status': 'error', 'message': 'Title and description required'}), 400
        
        if data['title'] not in EXPENSE_CATEGORIES:
            return jsonify({
                'status': 'error', 
                'message': f'Invalid category. Must be one of: {", ".join(EXPENSE_CATEGORIES)}'
            }), 400
        
        existing_category = mongo.db.categories.find_one({
            'user_id': user_id, 
            'title': data['title']
        })
        if existing_category:
            return jsonify({'status': 'error', 'message': 'Category already exists'}), 400
        
        category_doc = {
            'title': data['title'],
            'description': data['description'],
            'user_id': user_id,
            'total_amount': 0.0,  # Global amount for this category
            'expense_count': 0,   # Number of expenses in this category
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
        
        result = mongo.db.categories.insert_one(category_doc)
        category_id = str(result.inserted_id)
        
        category = {
            'id': category_id,
            'title': data['title'],
            'description': data['description'],
            'user_id': user_id,
            'created_at': category_doc['created_at'].isoformat()
        }
        
        return jsonify({
            'status': 'success',
            'message': 'Category created successfully',
            'data': {'category': category}
        }), 201
        
    except Exception as e:
        return jsonify({'status': 'error', 'message': f'Category creation failed: {str(e)}'}), 500

# EXPENSE ENDPOINTS

@app.route('/api/expenses', methods=['GET'])
@jwt_required()
def get_expenses():
    try:
        user_id = get_jwt_identity()
        
        query = {'user_id': user_id}
        
        category_id = request.args.get('category_id')
        if category_id:
            query['category_id'] = category_id
        
        filter_type = request.args.get('filter')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        now = datetime.utcnow()
        
        if filter_type == 'past_week':
            query['expense_date'] = {'$gte': now - timedelta(days=7)}
        elif filter_type == 'last_month':
            first_day_current = now.replace(day=1)
            last_month = first_day_current - timedelta(days=1)
            first_day_last_month = last_month.replace(day=1)
            query['expense_date'] = {
                '$gte': first_day_last_month,
                '$lte': last_month
            }
        elif filter_type == 'last_3_months':
            query['expense_date'] = {'$gte': now - timedelta(days=90)}
        elif filter_type == 'custom' and start_date and end_date:
            try:
                start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                query['expense_date'] = {'$gte': start_dt, '$lte': end_dt}
            except ValueError:
                return jsonify({'status': 'error', 'message': 'Invalid date format for custom filter'}), 400
        
        expenses_cursor = mongo.db.expenses.find(query).sort('expense_date', -1)
        expenses = list(expenses_cursor)
        
        for expense in expenses:
            expense['id'] = str(expense['_id'])
            del expense['_id']
            expense['expense_date'] = expense['expense_date'].isoformat()
            expense['created_at'] = expense['created_at'].isoformat() if 'created_at' in expense else None
        
        return jsonify({'status': 'success', 'data': {'expenses': expenses}})
        
    except Exception as e:
        return jsonify({'status': 'error', 'message': f'Failed to fetch expenses: {str(e)}'}), 500

@app.route('/api/expenses', methods=['POST'])
@jwt_required()
def create_expense():
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        required = ['amount', 'note', 'expense_date', 'category_id']
        for field in required:
            if field not in data:
                return jsonify({'status': 'error', 'message': f'{field} is required'}), 400
        
        try:
            amount = float(data['amount'])
            if amount <= 0:
                raise ValueError()
        except (ValueError, TypeError):
            return jsonify({'status': 'error', 'message': 'Amount must be positive number'}), 400
        
        category_id = data['category_id']
        category = mongo.db.categories.find_one({
            '_id': ObjectId(category_id),
            'user_id': user_id
        })
        if not category:
            return jsonify({'status': 'error', 'message': 'Invalid category'}), 400
        
        try:
            expense_date = datetime.fromisoformat(data['expense_date'].replace('Z', '+00:00'))
        except ValueError:
            return jsonify({'status': 'error', 'message': 'Invalid date format'}), 400
        
        expense_doc = {
            'amount': amount,
            'note': data['note'],
            'expense_date': expense_date,
            'category_id': category_id,
            'user_id': user_id,
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
        
        result = mongo.db.expenses.insert_one(expense_doc)
        expense_id = str(result.inserted_id)
        
        # Update category total amount and count
        mongo.db.categories.update_one(
            {'_id': ObjectId(category_id), 'user_id': user_id},
            {
                '$inc': {
                    'total_amount': amount,
                    'expense_count': 1
                },
                '$set': {'updated_at': datetime.utcnow()}
            }
        )
        
        expense = {
            'id': expense_id,
            'amount': amount,
            'note': data['note'],
            'expense_date': expense_date.isoformat(),
            'category_id': category_id,
            'user_id': user_id,
            'created_at': expense_doc['created_at'].isoformat()
        }
        
        return jsonify({
            'status': 'success',
            'message': 'Expense created successfully',
            'data': {'expense': expense}
        }), 201
        
    except Exception as e:
        return jsonify({'status': 'error', 'message': f'Expense creation failed: {str(e)}'}), 500

@app.route('/api/expenses/<expense_id>', methods=['PUT'])
@jwt_required()
def update_expense(expense_id):
    """Update an existing expense"""
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        # Find existing expense
        existing_expense = mongo.db.expenses.find_one({
            '_id': ObjectId(expense_id),
            'user_id': user_id
        })
        if not existing_expense:
            return jsonify({'status': 'error', 'message': 'Expense not found'}), 404
        
        # Validate new data
        required = ['amount', 'note', 'expense_date', 'category_id']
        for field in required:
            if field not in data:
                return jsonify({'status': 'error', 'message': f'{field} is required'}), 400
        
        try:
            new_amount = float(data['amount'])
            if new_amount <= 0:
                raise ValueError()
        except (ValueError, TypeError):
            return jsonify({'status': 'error', 'message': 'Amount must be positive number'}), 400
        
        # Validate category
        new_category_id = data['category_id']
        category = mongo.db.categories.find_one({
            '_id': ObjectId(new_category_id),
            'user_id': user_id
        })
        if not category:
            return jsonify({'status': 'error', 'message': 'Invalid category'}), 400
        
        try:
            expense_date = datetime.fromisoformat(data['expense_date'].replace('Z', '+00:00'))
        except ValueError:
            return jsonify({'status': 'error', 'message': 'Invalid date format'}), 400
        
        old_amount = existing_expense['amount']
        old_category_id = existing_expense['category_id']
        
        # Update expense
        update_doc = {
            'amount': new_amount,
            'note': data['note'],
            'expense_date': expense_date,
            'category_id': new_category_id,
            'updated_at': datetime.utcnow()
        }
        
        mongo.db.expenses.update_one(
            {'_id': ObjectId(expense_id), 'user_id': user_id},
            {'$set': update_doc}
        )
        
        # Update old category (subtract old amount)
        mongo.db.categories.update_one(
            {'_id': ObjectId(old_category_id), 'user_id': user_id},
            {
                '$inc': {
                    'total_amount': -old_amount,
                    'expense_count': -1
                },
                '$set': {'updated_at': datetime.utcnow()}
            }
        )
        
        # Update new category (add new amount)
        mongo.db.categories.update_one(
            {'_id': ObjectId(new_category_id), 'user_id': user_id},
            {
                '$inc': {
                    'total_amount': new_amount,
                    'expense_count': 1
                },
                '$set': {'updated_at': datetime.utcnow()}
            }
        )
        
        expense = {
            'id': expense_id,
            'amount': new_amount,
            'note': data['note'],
            'expense_date': expense_date.isoformat(),
            'category_id': new_category_id,
            'user_id': user_id,
            'updated_at': update_doc['updated_at'].isoformat()
        }
        
        return jsonify({
            'status': 'success',
            'message': 'Expense updated successfully',
            'data': {'expense': expense}
        })
        
    except Exception as e:
        return jsonify({'status': 'error', 'message': f'Expense update failed: {str(e)}'}), 500

@app.route('/api/expenses/<expense_id>', methods=['DELETE'])
@jwt_required()
def delete_expense(expense_id):
    """Delete an existing expense"""
    try:
        user_id = get_jwt_identity()
        
        # Find existing expense
        existing_expense = mongo.db.expenses.find_one({
            '_id': ObjectId(expense_id),
            'user_id': user_id
        })
        if not existing_expense:
            return jsonify({'status': 'error', 'message': 'Expense not found'}), 404
        
        amount = existing_expense['amount']
        category_id = existing_expense['category_id']
        
        # Delete expense
        mongo.db.expenses.delete_one({
            '_id': ObjectId(expense_id),
            'user_id': user_id
        })
        
        # Update category (subtract amount and count)
        mongo.db.categories.update_one(
            {'_id': ObjectId(category_id), 'user_id': user_id},
            {
                '$inc': {
                    'total_amount': -amount,
                    'expense_count': -1
                },
                '$set': {'updated_at': datetime.utcnow()}
            }
        )
        
        return jsonify({
            'status': 'success',
            'message': 'Expense deleted successfully',
            'data': {
                'deleted_expense_id': expense_id,
                'amount_removed': amount
            }
        })
        
    except Exception as e:
        return jsonify({'status': 'error', 'message': f'Expense deletion failed: {str(e)}'}), 500

# INCOME ENDPOINTS

@app.route('/api/income', methods=['POST'])
@jwt_required()
def set_monthly_income():
    """Set monthly income for user"""
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data.get('amount'):
            return jsonify({'status': 'error', 'message': 'Amount is required'}), 400
        
        try:
            amount = float(data['amount'])
            if amount <= 0:
                raise ValueError()
        except (ValueError, TypeError):
            return jsonify({'status': 'error', 'message': 'Amount must be positive number'}), 400
        
        # Update or create income record
        income_doc = {
            'user_id': user_id,
            'amount': amount,
            'month': datetime.utcnow().strftime('%Y-%m'),
            'updated_at': datetime.utcnow()
        }
        
        # Upsert income record
        mongo.db.income.update_one(
            {'user_id': user_id, 'month': income_doc['month']},
            {'$set': income_doc},
            upsert=True
        )
        
        return jsonify({
            'status': 'success',
            'message': 'Monthly income set successfully',
            'data': {
                'income': {
                    'amount': amount,
                    'month': income_doc['month']
                }
            }
        }), 201
        
    except Exception as e:
        return jsonify({'status': 'error', 'message': f'Failed to set income: {str(e)}'}), 500

@app.route('/api/income', methods=['GET'])
@jwt_required()
def get_monthly_income():
    """Get current month's income"""
    try:
        user_id = get_jwt_identity()
        current_month = datetime.utcnow().strftime('%Y-%m')
        
        income = mongo.db.income.find_one({
            'user_id': user_id,
            'month': current_month
        })
        
        if not income:
            return jsonify({
                'status': 'success',
                'data': {
                    'income': {
                        'amount': 0,
                        'month': current_month,
                        'message': 'No income set for this month'
                    }
                }
            })
        
        return jsonify({
            'status': 'success',
            'data': {
                'income': {
                    'amount': income['amount'],
                    'month': income['month']
                }
            }
        })
        
    except Exception as e:
        return jsonify({'status': 'error', 'message': f'Failed to get income: {str(e)}'}), 500

# SAVINGS CALCULATION ENDPOINT

@app.route('/api/savings', methods=['GET'])
@jwt_required()
def calculate_savings():
    """Calculate savings based on income and expenses"""
    try:
        user_id = get_jwt_identity()
        current_month = datetime.utcnow().strftime('%Y-%m')
        
        # Get monthly income
        income_record = mongo.db.income.find_one({
            'user_id': user_id,
            'month': current_month
        })
        
        monthly_income = income_record['amount'] if income_record else 0
        
        # Get current month expenses
        first_day_current = datetime.utcnow().replace(day=1)
        last_day_current = (first_day_current + timedelta(days=32)).replace(day=1) - timedelta(days=1)
        
        expenses = list(mongo.db.expenses.find({
            'user_id': user_id,
            'expense_date': {
                '$gte': first_day_current,
                '$lte': last_day_current
            }
        }))
        
        # Calculate total expenses
        total_expenses = sum(exp['amount'] for exp in expenses)
        
        # Calculate savings
        savings = monthly_income - total_expenses
        
        # Get all user categories with their global amounts
        user_categories = list(mongo.db.categories.find({'user_id': user_id}))
        category_breakdown = {}
        
        for category in user_categories:
            cat_id = str(category['_id'])
            category_breakdown[cat_id] = {
                'category_name': category['title'],
                'total_amount': category.get('total_amount', 0.0),
                'expense_count': category.get('expense_count', 0),
                'monthly_amount': 0.0,  # Amount spent this month
                'monthly_count': 0      # Expenses this month
            }
        
        # Calculate monthly expenses by category
        for expense in expenses:
            cat_id = expense['category_id']
            if cat_id in category_breakdown:
                category_breakdown[cat_id]['monthly_amount'] += expense['amount']
                category_breakdown[cat_id]['monthly_count'] += 1
        
        return jsonify({
            'status': 'success',
            'data': {
                'monthly_summary': {
                    'month': current_month,
                    'income': monthly_income,
                    'total_expenses': total_expenses,
                    'savings': savings,
                    'savings_percentage': round((savings / monthly_income * 100) if monthly_income > 0 else 0, 2)
                },
                'expense_breakdown': {
                    'total_count': len(expenses),
                    'categories': category_breakdown
                }
            }
        })
        
    except Exception as e:
        return jsonify({'status': 'error', 'message': f'Failed to calculate savings: {str(e)}'}), 500

# ERROR HANDLERS
@app.errorhandler(404)
def not_found(error):
    return jsonify({'status': 'error', 'message': 'Endpoint not found'}), 404

@app.errorhandler(405)
def method_not_allowed(error):
    return jsonify({'status': 'error', 'message': 'Method not allowed'}), 405

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'status': 'error', 'message': 'Internal server error'}), 500

if __name__ == '__main__':
    print("=" * 80)
    print("ENHANCED EXPENSE TRACKER API - WITH INCOME & SAVINGS")
    print("=" * 80)
    print("ALL REQUIREMENTS IMPLEMENTED:")
    print("   - User Authentication with JWT")
    print("   - User Signup Functionality")
    print("   - JWT Token Generation & Validation")
    print("   - Expense Filtering")
    print("   - Expense CRUD Operations")
    print("   - JWT Protection on ALL endpoints")
    print("   - Predefined Categories:", ", ".join(EXPENSE_CATEGORIES))
    print("   - MONGODB DATA PERSISTENCE")
    print()
    print("NEW FEATURES ADDED:")
    print("   - Monthly Income Tracking")
    print("   - Savings Calculation")
    print("   - Global Category Amount Tracking")
    print("   - Complete Expense CRUD (Update & Delete)")
    print("   - Advanced Filtering (Custom Date Ranges)")
    print("   - Accurate Balance Detection")
    print()
    print("SERVER STARTING ON: http://127.0.0.1:5000")
    print("=" * 80)
    print("READY FOR POSTMAN TESTING!")
    print("=" * 80)
    
    app.run(debug=True, host='127.0.0.1', port=5000)
