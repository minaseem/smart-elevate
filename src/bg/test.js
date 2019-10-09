const curry = (fn, ...args) => {
    return fn.length === args.length ? fn(...args) : curry.bind(null, fn, ...args);
};

const getUserDetails = curry((detailkey, userObject) => {
    return userObject && userObject[detailkey];
})

let user = {
    name: 'Himanshu',
    age: 23
};

console.log(((detailkey, userObject, a,b,c) => {
    return userObject && userObject[detailkey];
}).length);
const getUserName = getUserDetails('name');



console.log(getUserName(user))
console.log(getUserName(user))
console.log(getUserName(user))
console.log(getUserName(user))
console.log(getUserName(user))
console.log(getUserName(user))
console.log(getUserName(user))
console.log(getUserName(user))
console.log(getUserName(user))
console.log(getUserName(user))
console.log(getUserName(user))


