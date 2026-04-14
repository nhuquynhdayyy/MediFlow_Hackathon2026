def validate_route(route, user_departments):
    for dep in route:
        if dep not in user_departments:
            return False
    return True